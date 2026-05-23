const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db');
const mail = require('../mail');
const { authenticate, requireAdmin } = require('../middleware');

router.get('/', authenticate, async (req, res) => {
  try {
    const { estado, serie, rut, limit = 100 } = req.query;
    let sql = `
      SELECT a.*,
             c.nombre AS colaborador_nombre, c.correo AS colaborador_correo, c.area AS colaborador_area,
             act.marca, act.modelo, act.tipo_dispositivo, act.imei
      FROM asignaciones a
      JOIN colaboradores c ON a.rut_colaborador = c.rut
      JOIN activos act ON a.serie_activo = act.serie
      WHERE 1=1
    `;
    const params = [];
    if (estado) { params.push(estado); sql += ` AND a.estado = $${params.length}`; }
    if (serie)  { params.push(serie);  sql += ` AND a.serie_activo = $${params.length}`; }
    if (rut)    { params.push(rut);    sql += ` AND a.rut_colaborador = $${params.length}`; }
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    const { rows } = await db.pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('getAsignaciones:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { serie_activo, rut_colaborador, entregado_por, notas } = req.body;
    if (!serie_activo || !rut_colaborador) {
      return res.status(400).json({ error: 'serie_activo y rut_colaborador son requeridos' });
    }

    await client.query('BEGIN');

    const { rows: activas } = await client.query(
      `SELECT id FROM asignaciones WHERE serie_activo = $1 AND estado = 'activa'`, [serie_activo]
    );
    if (activas.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este equipo ya tiene una asignación activa' });
    }

    const { rows: [activo] } = await client.query('SELECT * FROM activos WHERE serie = $1', [serie_activo]);
    const { rows: [colaborador] } = await client.query('SELECT * FROM colaboradores WHERE rut = $1', [rut_colaborador]);
    if (!activo || !colaborador) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Activo o colaborador no encontrado' });
    }

    const { rows: [asignacion] } = await client.query(`
      INSERT INTO asignaciones (serie_activo, rut_colaborador, entregado_por, notas, usuario_id, estado)
      VALUES ($1, $2, $3, $4, $5, 'activa') RETURNING *
    `, [serie_activo, rut_colaborador, entregado_por || null, notas || null, req.user.id]);

    await client.query(
      `UPDATE activos SET rut_responsable = $1, estado = 'Asignado', updated_at = NOW() WHERE serie = $2`,
      [rut_colaborador, serie_activo]
    );
    await client.query(`
      INSERT INTO historial_activos (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id)
      VALUES ($1, NULL, $2, $3, 'Asignado', 'asignacion', $4, $5)
    `, [serie_activo, rut_colaborador, activo.estado, notas || null, req.user.id]);

    await client.query('COMMIT');

    mail.sendMailAsignacion({ colaborador, activo, entregadoPor: entregado_por || req.user.nombre, fecha: new Date() })
      .catch(err => console.error('[mail] asignación:', err.message));

    res.status(201).json({ data: asignacion, message: 'Asignación creada exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('crearAsignacion:', error);
    res.status(500).json({ error: 'Error al crear la asignación' });
  } finally {
    client.release();
  }
});

router.put('/:id/cerrar', authenticate, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { motivo_devolucion, estado_fisico_devolucion, desvincular_colaborador, correo_alterno } = req.body;
    const nuevoEstado = estado_fisico_devolucion || 'Disponible';

    await client.query('BEGIN');

    const { rows: [asignacion] } = await client.query(`
      SELECT a.*, c.nombre AS colab_nombre, c.correo AS colab_correo, c.area AS colab_area,
             act.marca, act.modelo, act.tipo_dispositivo, act.imei, act.serie
      FROM asignaciones a
      JOIN colaboradores c ON a.rut_colaborador = c.rut
      JOIN activos act ON a.serie_activo = act.serie
      WHERE a.id = $1 AND a.estado = 'activa'
    `, [id]);
    if (!asignacion) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Asignación activa no encontrada' });
    }

    const emailDestino = asignacion.colab_correo || correo_alterno || null;
    let tokenConfirmacion = null;
    let tokenExpiraAt = null;
    let estadoAsignacion = 'cerrada';

    if (emailDestino) {
      tokenConfirmacion = crypto.randomBytes(32).toString('hex');
      tokenExpiraAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      estadoAsignacion = 'pendiente_firma';
    }

    const { rows: [asignacionCerrada] } = await client.query(`
      UPDATE asignaciones SET
        fecha_fin = NOW(), motivo_devolucion = $1, estado_fisico_devolucion = $2,
        desvincular_colaborador = $3, token_confirmacion = $4, token_expira_at = $5, estado = $6
      WHERE id = $7 RETURNING *
    `, [motivo_devolucion || null, nuevoEstado, !!desvincular_colaborador,
        tokenConfirmacion, tokenExpiraAt, estadoAsignacion, id]);

    await client.query(
      `UPDATE activos SET rut_responsable = NULL, estado = $1, updated_at = NOW() WHERE serie = $2`,
      [nuevoEstado, asignacion.serie_activo]
    );
    await client.query(`
      INSERT INTO historial_activos (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id)
      VALUES ($1, $2, NULL, 'Asignado', $3, 'devolucion', $4, $5)
    `, [asignacion.serie_activo, asignacion.rut_colaborador, nuevoEstado, motivo_devolucion || null, req.user.id]);

    if (desvincular_colaborador) {
      await client.query(
        `UPDATE colaboradores SET activo = false, updated_at = NOW() WHERE rut = $1`,
        [asignacion.rut_colaborador]
      );
    }

    await client.query('COMMIT');

    if (emailDestino && tokenConfirmacion) {
      mail.sendMailConfirmacionDevolucion({
        colaborador: { nombre: asignacion.colab_nombre, rut: asignacion.rut_colaborador, area: asignacion.colab_area },
        activo: { marca: asignacion.marca, modelo: asignacion.modelo, tipo_dispositivo: asignacion.tipo_dispositivo, serie: asignacion.serie_activo, imei: asignacion.imei },
        token: tokenConfirmacion,
        emailDestino,
        viaPersonal: !asignacion.colab_correo && !!correo_alterno,
      }).catch(err => console.error('[mail] confirmación:', err.message));
    }

    res.json({ data: asignacionCerrada, message: 'Devolución registrada exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('cerrarAsignacion:', error);
    res.status(500).json({ error: 'Error al registrar la devolución' });
  } finally {
    client.release();
  }
});

// Ruta pública — confirmación digital desde link del email
router.get('/confirmar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { rows: [asignacion] } = await db.pool.query(`
      SELECT a.*, c.nombre AS colab_nombre, act.marca, act.modelo
      FROM asignaciones a
      JOIN colaboradores c ON a.rut_colaborador = c.rut
      JOIN activos act ON a.serie_activo = act.serie
      WHERE a.token_confirmacion = $1
    `, [token]);

    if (!asignacion) {
      return res.status(404).send(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#fef2f2">
        <h2 style="color:#dc2626">❌ Link inválido</h2><p>Este enlace no existe o ya fue utilizado.</p>
      </body></html>`);
    }
    if (asignacion.token_expira_at && new Date() > new Date(asignacion.token_expira_at)) {
      return res.status(410).send(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#fff7ed">
        <h2 style="color:#f97316">⏱ Link expirado</h2>
        <p>Este enlace de confirmación ya expiró (válido 72 horas).</p>
        <p>Contacta al Departamento de TI para reenviar el enlace.</p>
      </body></html>`);
    }

    await db.pool.query(
      `UPDATE asignaciones SET confirmado_at = NOW(), estado = 'cerrada', token_confirmacion = NULL WHERE token_confirmacion = $1`,
      [token]
    );

    res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#f0fdf4">
      <div style="max-width:500px;margin:0 auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);border-top:5px solid #22c55e">
        <h2 style="color:#16a34a">✅ Devolución confirmada</h2>
        <p style="color:#475569">Hola <strong>${asignacion.colab_nombre}</strong>,</p>
        <p style="color:#475569">Hemos registrado tu confirmación de devolución del equipo:</p>
        <p style="background:#f8fafc;padding:12px;border-radius:8px;font-weight:bold;color:#1e293b">${asignacion.marca} ${asignacion.modelo}</p>
        <p style="font-size:13px;color:#94a3b8;margin-top:30px">© 2026 Domino's Pizza Chile — Departamento de TI</p>
      </div>
    </body></html>`);
  } catch (error) {
    console.error('confirmarDevolucion:', error);
    res.status(500).send('<html><body>Error al procesar la confirmación.</body></html>');
  }
});

module.exports = router;
