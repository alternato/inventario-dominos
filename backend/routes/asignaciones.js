const router = require('express').Router();
const db = require('../db');
const mail = require('../mail');
const { authenticate, requireAdmin } = require('../middleware');
const { validate, createAsignacionSchema, cerrarAsignacionSchema } = require('../schemas');
const { ApiError } = require('../lib/apiError');

// Listado con filtros + paginación (Req. 6.3). Delega en la capa db.
router.get('/', authenticate, async (req, res, next) => {
  try {
    res.json(await db.getAsignaciones(req.query));
  } catch (error) {
    next(error);
  }
});

// Crear asignación (Req. 7.1, 7.2). Solo admin; viewer → 403 (requireAdmin).
router.post('/', authenticate, requireAdmin, validate(createAsignacionSchema), async (req, res, next) => {
  try {
    const asignacion = await db.crearAsignacion({ ...req.body, usuario_id: req.user.id });

    // Notificación por correo best-effort — nunca bloquea la respuesta.
    const [activo, colaborador] = await Promise.all([
      db.getActivoBySerie(asignacion.serie_activo),
      db.getColaboradorByRut(asignacion.rut_colaborador),
    ]);
    mail.sendMailAsignacion({
      colaborador,
      activo,
      entregadoPor: asignacion.entregado_por || req.user.nombre,
      fecha: new Date(),
    }).catch(err => console.error('[mail] asignación:', err.message));

    res.status(201).json({ data: asignacion, message: 'Asignación creada exitosamente' });
  } catch (error) {
    next(error);
  }
});

// Cerrar asignación / registrar devolución (Req. 8.1–8.4). Solo admin.
router.put('/:id/cerrar', authenticate, requireAdmin, validate(cerrarAsignacionSchema), async (req, res, next) => {
  try {
    const { asignacion, token, emailDestino } = await db.cerrarAsignacion({
      id: req.params.id,
      ...req.body,
      usuario_id: req.user.id,
    });

    // Si se generó token de confirmación, enviar correo best-effort.
    if (token && emailDestino) {
      mail.sendMailConfirmacionDevolucion({
        colaborador: {
          nombre: asignacion.colaborador_nombre || null,
          rut: asignacion.rut_colaborador,
          area: asignacion.colaborador_area || null,
        },
        activo: {
          marca: asignacion.marca || null,
          modelo: asignacion.modelo || null,
          tipo_dispositivo: asignacion.tipo_dispositivo || null,
          serie: asignacion.serie_activo,
          imei: asignacion.imei || null,
        },
        token,
        emailDestino,
        viaPersonal: asignacion.confirmado_via === 'alterno',
      }).catch(err => console.error('[mail] confirmación:', err.message));
    }

    res.json({ data: asignacion, message: 'Devolución registrada exitosamente' });
  } catch (error) {
    next(error);
  }
});

// Ruta pública — confirmación digital desde link del email (Req. 8.5–8.7).
// Responde SIEMPRE en HTML: 200 (confirmada), 404 (link inválido/usado),
// 410 (link expirado).
router.get('/confirmar/:token', async (req, res) => {
  try {
    const asignacion = await db.confirmarFirma(req.params.token);

    res.send(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#f0fdf4">
      <div style="max-width:500px;margin:0 auto;background:white;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);border-top:5px solid #22c55e">
        <h2 style="color:#16a34a">✅ Devolución confirmada</h2>
        <p style="color:#475569">Hola <strong>${asignacion.colaborador_nombre}</strong>,</p>
        <p style="color:#475569">Hemos registrado tu confirmación de devolución del equipo:</p>
        <p style="background:#f8fafc;padding:12px;border-radius:8px;font-weight:bold;color:#1e293b">${asignacion.marca} ${asignacion.modelo}</p>
        <p style="font-size:13px;color:#94a3b8;margin-top:30px">© 2026 Domino's Pizza Chile — Departamento de TI</p>
      </div>
    </body></html>`);
  } catch (error) {
    if (error instanceof ApiError && error.type === 'NOT_FOUND') {
      return res.status(404).send(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#fef2f2">
        <h2 style="color:#dc2626">❌ Link inválido</h2><p>Este enlace no existe o ya fue utilizado.</p>
      </body></html>`);
    }
    if (error instanceof ApiError && error.type === 'GONE') {
      return res.status(410).send(`<html><body style="font-family:Arial;text-align:center;padding:60px;background:#fff7ed">
        <h2 style="color:#f97316">⏱ Link expirado</h2>
        <p>Este enlace de confirmación ya expiró (válido 72 horas).</p>
        <p>Contacta al Departamento de TI para reenviar el enlace.</p>
      </body></html>`);
    }
    console.error('confirmarDevolucion:', error);
    res.status(500).send('<html><body>Error al procesar la confirmación.</body></html>');
  }
});

module.exports = router;
