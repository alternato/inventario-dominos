const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const mail = require('./mail');

// =============================================
// POOL DE CONEXIONES A POSTGRESQL
// =============================================
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'inventario_db',
  user:     process.env.DB_USER     || 'inventario_user',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  // Pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Verificar conexión al arrancar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    console.error('   Verifica las variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD en .env');
  } else {
    console.log(`✅ Conectado a PostgreSQL en ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'inventario_db'}`);
    release();
  }
});

// Helper: ejecutar query con manejo de errores
const query = (text, params) => pool.query(text, params);

// =============================================
// USUARIOS
// =============================================

const getUsuarioByEmail = async (email) => {
  const { rows } = await query(
    'SELECT * FROM usuarios WHERE email = $1 LIMIT 1',
    [email]
  );
  return rows[0] || null;
};

const getUsuarios = async () => {
  const { rows } = await query(
    `SELECT id, email, nombre, rol, activo, created_at,
     CASE WHEN pin IS NOT NULL THEN true ELSE false END AS pin
     FROM usuarios ORDER BY nombre ASC`
  );
  return rows;
};

const createUsuario = async (data) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  const { rows } = await query(
    `INSERT INTO usuarios (email, nombre, password, rol, activo, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, NOW(), NOW())
     RETURNING id, email, nombre, rol, activo, created_at`,
    [data.email, data.nombre, hashedPassword, data.rol || 'viewer']
  );
  return rows[0];
};

const updateUsuario = async (id, data) => {
  const { nombre, email, rol, activo } = data;
  const { rows } = await query(
    `UPDATE usuarios
     SET nombre = $1, email = $2, rol = $3, activo = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING id, email, nombre, rol, activo, created_at,
       CASE WHEN pin IS NOT NULL THEN true ELSE false END AS pin`,
    [nombre, email, rol, activo, id]
  );
  return rows[0] || null;
};

const updatePasswordReset = async (email, token, expiresAt) => {
  await query(
    `UPDATE usuarios SET reset_token = $1, reset_token_expires = $2, updated_at = NOW()
     WHERE email = $3`,
    [token, expiresAt, email]
  );
};

const resetPassword = async (token, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const { rows } = await query(
    `UPDATE usuarios
     SET password = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
     WHERE reset_token = $2 AND reset_token_expires > NOW()
     RETURNING id, email, nombre, rol`,
    [hashedPassword, token]
  );
  return rows[0] || null;
};

// =============================================
// ACTIVOS
// =============================================

const getActivos = async () => {
  const { rows } = await query(
    `SELECT
       a.*,
       json_build_object('nombre', c.nombre, 'correo', c.correo, 'area', c.area) AS colaborador
     FROM activos a
     LEFT JOIN colaboradores c ON a.rut_responsable = c.rut AND c.deleted_at IS NULL
     WHERE a.deleted_at IS NULL
     ORDER BY a.created_at DESC`
  );
  return rows;
};

const getActivoBySerie = async (serie) => {
  const { rows } = await query(
    `SELECT
       a.*,
       json_build_object('nombre', c.nombre, 'correo', c.correo) AS colaborador
     FROM activos a
     LEFT JOIN colaboradores c ON a.rut_responsable = c.rut AND c.deleted_at IS NULL
     WHERE a.serie = $1 AND a.deleted_at IS NULL
     LIMIT 1`,
    [serie]
  );
  return rows[0] || null;
};

const createActivo = async (activoData, usuarioId = null) => {
  const {
    serie, marca, modelo, estado, tipo_dispositivo,
    rut_responsable, ubicacion, observaciones,
    fecha_compra, valor, numero_factura, imei, numero_sim, imsi,
    numero_telefono, compania
  } = activoData;

  const { rows } = await query(
    `INSERT INTO activos
       (serie, marca, modelo, estado, tipo_dispositivo, rut_responsable,
        ubicacion, observaciones, fecha_compra, valor, numero_factura,
        imei, numero_sim, imsi, numero_telefono, compania, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
     RETURNING *`,
    [
      serie, marca, modelo, estado, tipo_dispositivo,
      rut_responsable || null, ubicacion || null, observaciones || null,
      fecha_compra || null, valor || null, numero_factura || null,
      imei || null, numero_sim || null, imsi || null,
      numero_telefono || null, compania || null
    ]
  );

  // Registrar en historial como 'creacion'
  await registrarHistorial({
    serie,
    rut_anterior: null,
    rut_nuevo: rut_responsable || null,
    estado_anterior: null,
    estado_nuevo: estado,
    tipo_movimiento: 'creacion',
    usuario_id: usuarioId,
    observaciones: `Activo creado: ${marca} ${modelo}`,
  });

  return rows[0];
};

const updateActivo = async (serie, activoData, usuarioId = null) => {
  // Obtener estado anterior para historial
  const anterior = await getActivoBySerie(serie);

  const {
    serie: serieIngresada,
    marca, modelo, estado, tipo_dispositivo,
    rut_responsable, ubicacion, observaciones,
    fecha_compra, valor, numero_factura, imei, numero_sim, imsi,
    numero_telefono, compania,
    // Payload extra de devolución
    motivo_devolucion, desvincular_usuario, falta_firma
  } = activoData;

  let nuevaSerie = serieIngresada ? serieIngresada.trim().toUpperCase() : serie;
  // Prevenir vacíos por error
  nuevaSerie = nuevaSerie === '' ? serie : nuevaSerie;

  const { rows } = await query(
    `UPDATE activos SET
       serie = $1, marca = $2, modelo = $3, estado = $4, tipo_dispositivo = $5,
       rut_responsable = $6, ubicacion = $7, observaciones = $8,
       fecha_compra = $9, valor = $10, numero_factura = $11,
       imei = $12, numero_sim = $13, imsi = $14,
       numero_telefono = $15, compania = $16, updated_at = NOW()
     WHERE serie = $17
     RETURNING *`,
    [
      nuevaSerie,
      marca, modelo, estado, tipo_dispositivo,
      rut_responsable || null, ubicacion || null, observaciones || null,
      fecha_compra || null, valor || null, numero_factura || null,
      imei || null, numero_sim || null, imsi || null,
      numero_telefono || null, compania || null,
      serie
    ]
  );

  // Si la serie cambió, debemos heredar la trazabilidad manual de historial_activos
  if (nuevaSerie !== serie) {
    console.log(`[updateActivo] La serie primaria cambió de ${serie} a ${nuevaSerie}. Actualizando historial...`);
    await query(`UPDATE historial_activos SET serie = $1 WHERE serie = $2`, [nuevaSerie, serie]);
  }

  // Registrar en historial si hubo cambio de responsable o estado
  if (anterior) {
    const cambioResponsable = anterior.rut_responsable !== (rut_responsable || null);
    const cambioEstado = anterior.estado !== estado;

    if (cambioResponsable || cambioEstado) {
      let tipoMovimiento = 'cambio_estado';
      if (cambioResponsable && rut_responsable) tipoMovimiento = 'asignacion';
      if (cambioResponsable && !rut_responsable) tipoMovimiento = 'devolucion';

      let notasHistorial = null;
      if (motivo_devolucion) {
        notasHistorial = `Devolución por: ${motivo_devolucion}`;
      }

      await registrarHistorial({
        serie: nuevaSerie,
        rut_anterior: anterior.rut_responsable,
        rut_nuevo: rut_responsable || null,
        estado_anterior: anterior.estado,
        estado_nuevo: estado,
        tipo_movimiento: tipoMovimiento,
        usuario_id: usuarioId,
        notas: notasHistorial,
      });

      // Flujo 1: Desvincular Colaborador
      if (desvincular_usuario && anterior.rut_responsable) {
        await desactivarColaborador(anterior.rut_responsable);
      }

      // Flujo 2: Falta Firma
      if (falta_firma && anterior.rut_responsable) {
        try {
          const colaborador = await getColaboradorByRut(anterior.rut_responsable);
          const activoDetalle = await getActivoBySerie(serie);
          await mail.sendMissingSignatureAlert(activoDetalle, colaborador, 'informatica@dominospizza.cl');
        } catch (err) {
          console.error('[Mail] Error enviando alerta de falta de firma:', err);
        }
      }
      if (cambioEstado && (estado === 'Mantenimiento' || estado === 'Descartado')) {
        try {
          // Obtener información adicional para el correo
          const activoDetalle = await getActivoBySerie(serie);
          // Ocupar el correo solicitado: informatica@dominospizza.cl
          await mail.sendStatusEventAlert(activoDetalle, anterior.estado, estado, 'informatica@dominospizza.cl');
        } catch (error) {
          console.error('[Mail] Error enviando alerta de cambio de estado:', error);
        }
      }
    }
  }

  // Notar que ahora se devuelve el primer registro con su serie nueva si la hubo
  return rows[0];
};

const deleteActivo = async (serie, usuarioId = null) => {
  // Guardar snapshot antes de borrar para el historial
  const activo = await getActivoBySerie(serie);

  console.log(`[deleteActivo] Intentando borrar suavemente serie="${serie}" | Encontrado en BD: ${!!activo}`);

  const stamp = Date.now();
  const result = await query(
    `UPDATE activos 
     SET deleted_at = NOW(), 
         serie = serie || '_borrado_' || $2 
     WHERE serie = $1 
     RETURNING *`, 
    [serie, stamp]
  );

  console.log(`[deleteActivo] Filas ocultadas (soft delete): ${result.rowCount}`);

  if (result.rowCount === 0) {
    throw new Error(`No se encontró activo con serie: "${serie}" (0 filas afectadas)`);
  }

  // Registrar baja en historial (persiste aunque el activo ya no exista)
  if (activo) {
    await registrarHistorial({
      serie,
      rut_anterior: activo.rut_responsable,
      rut_nuevo: null,
      estado_anterior: activo.estado,
      estado_nuevo: 'Baja',
      tipo_movimiento: 'baja',
      usuario_id: usuarioId,
      notas: `Activo dado de baja: ${activo.marca} ${activo.modelo}`,
    });
  }
};

// =============================================
// COLABORADORES
// =============================================

const getColaboradores = async () => {
  const { rows } = await query(
    `SELECT
       c.*,
       COUNT(a.serie) AS total_activos
     FROM colaboradores c
     LEFT JOIN activos a ON a.rut_responsable = c.rut AND a.estado = 'Asignado' AND a.deleted_at IS NULL
     WHERE c.deleted_at IS NULL
     GROUP BY c.id, c.rut
     ORDER BY c.nombre ASC`
  );
  return rows;
};

const getColaboradorByRut = async (rut) => {
  const { rows } = await query(
    'SELECT * FROM colaboradores WHERE rut = $1 AND deleted_at IS NULL LIMIT 1',
    [rut]
  );
  return rows[0] || null;
};

const getActivosByColaborador = async (rut) => {
  const { rows } = await query(
    `SELECT * FROM activos WHERE rut_responsable = $1 AND deleted_at IS NULL ORDER BY tipo_dispositivo ASC`,
    [rut]
  );
  return rows;
};

const createColaborador = async (colaboradorData) => {
  const { rut, nombre, correo, area, cargo, telefono } = colaboradorData;
  const { rows } = await query(
    `INSERT INTO colaboradores (rut, nombre, correo, area, cargo, telefono, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
     RETURNING *`,
    [rut, nombre, correo || null, area, cargo || null, telefono || null]
  );
  return rows[0];
};

const updateColaborador = async (rut, colaboradorData) => {
  const { rut: rutNuevo, nombre, correo, area, cargo, telefono } = colaboradorData;
  const { rows } = await query(
    `UPDATE colaboradores SET
       rut = $1, nombre = $2, correo = $3, area = $4, cargo = $5,
       telefono = $6, updated_at = NOW()
     WHERE rut = $7
     RETURNING *`,
    [rutNuevo || rut, nombre, correo || null, area, cargo || null, telefono || null, rut]
  );
  return rows[0];
};

const desactivarColaborador = async (rut) => {
  console.log(`[desactivarColaborador] Desvinculando colaborador RUT: ${rut}`);
  await query(
    `UPDATE colaboradores SET activo = false, updated_at = NOW() WHERE rut = $1`,
    [rut]
  );
};

const deleteColaborador = async (rut, usuarioId = null) => {
  // M3: Registrar desasignación de todos los activos antes de eliminar
  const activos = await getActivosByColaborador(rut);
  for (const activo of activos) {
    await registrarHistorial({
      serie: activo.serie,
      rut_anterior: rut,
      rut_nuevo: null,
      estado_anterior: activo.estado,
      estado_nuevo: activo.estado,
      tipo_movimiento: 'devolucion',
      usuario_id: usuarioId,
      notas: `Desasignación automática por eliminación de colaborador`,
    });
  }
  const stamp = Date.now();
  await query(
    `UPDATE colaboradores 
     SET deleted_at = NOW(), 
         rut = rut || '_borrado_' || $2
     WHERE rut = $1`, 
    [rut, stamp]
  );
};

// =============================================
// HISTORIAL / TRAZABILIDAD
// =============================================

const registrarHistorial = async ({ serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id }) => {
  await query(
    `INSERT INTO historial_activos
       (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
    [serie, rut_anterior || null, rut_nuevo || null, estado_anterior || null, estado_nuevo || null, tipo_movimiento, notas || null, usuario_id || null]
  );
};

const getHistorial = async ({ serie, rut, desde, hasta, limit = 100 } = {}) => {
  let condiciones = [];
  let params = [];
  let idx = 1;

  if (serie) { condiciones.push(`h.serie = $${idx++}`); params.push(serie); }
  if (rut)   { condiciones.push(`(h.rut_anterior = $${idx} OR h.rut_nuevo = $${idx++})`); params.push(rut); }
  if (desde) { condiciones.push(`h.created_at >= $${idx++}`); params.push(desde); }
  if (hasta) { condiciones.push(`h.created_at <= $${idx++}`); params.push(hasta); }

  const where = condiciones.length > 0 ? 'WHERE ' + condiciones.join(' AND ') : '';

  const { rows } = await query(
    `SELECT
       h.*,
       a.marca, a.modelo, a.tipo_dispositivo,
       c_ant.nombre AS nombre_anterior,
       c_nue.nombre AS nombre_nuevo,
       u.nombre AS registrado_por
     FROM historial_activos h
     LEFT JOIN activos a ON h.serie = a.serie
     LEFT JOIN colaboradores c_ant ON h.rut_anterior = c_ant.rut
     LEFT JOIN colaboradores c_nue ON h.rut_nuevo = c_nue.rut
     LEFT JOIN usuarios u ON h.usuario_id = u.id
     ${where}
     ORDER BY h.created_at DESC
     LIMIT $${idx}`,
    [...params, limit]
  );
  return rows;
};

// =============================================
// BÚSQUEDA GLOBAL
// =============================================

const buscarGlobal = async (q) => {
  const termino = `%${q.toLowerCase()}%`;

  const [activosResult, colaboradoresResult] = await Promise.all([
    query(
      `SELECT
         a.*,
         c.nombre AS colaborador_nombre
       FROM activos a
       LEFT JOIN colaboradores c ON a.rut_responsable = c.rut
       WHERE
         a.deleted_at IS NULL AND
         (
           LOWER(a.serie) LIKE $1 OR
           LOWER(a.marca) LIKE $1 OR
           LOWER(a.modelo) LIKE $1 OR
           LOWER(COALESCE(a.imei,'')) LIKE $1 OR
           LOWER(COALESCE(a.numero_sim,'')) LIKE $1 OR
           LOWER(COALESCE(a.imsi,'')) LIKE $1 OR
           LOWER(COALESCE(c.nombre,'')) LIKE $1
         )
       ORDER BY a.updated_at DESC
       LIMIT 20`,
      [termino]
    ),
    query(
      `SELECT * FROM colaboradores
       WHERE
         deleted_at IS NULL AND
         (
           LOWER(nombre) LIKE $1 OR
           LOWER(rut) LIKE $1 OR
           LOWER(COALESCE(correo,'')) LIKE $1 OR
           LOWER(COALESCE(telefono,'')) LIKE $1 OR
           LOWER(COALESCE(cargo,'')) LIKE $1 OR
           LOWER(COALESCE(area,'')) LIKE $1
         )
       ORDER BY nombre ASC
       LIMIT 20`,
      [termino]
    )
  ]);

  return {
    activos: activosResult.rows,
    colaboradores: colaboradoresResult.rows,
  };
};

// =============================================
// KPIs PARA DASHBOARD
// =============================================

const getKPIs = async () => {
  const [totales, porTipo, porEstado, topColaboradores, actividadMensual, duplicadosImeis, duplicadosSims] = await Promise.all([
    query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado = 'Asignado') AS asignados,
        COUNT(*) FILTER (WHERE estado = 'Disponible') AS disponibles,
        COUNT(*) FILTER (WHERE estado = 'Mantenimiento') AS mantenimiento,
        COUNT(*) FILTER (WHERE estado = 'Descartado') AS descartados
      FROM activos
      WHERE deleted_at IS NULL
    `),
    query(`
      SELECT tipo_dispositivo, COUNT(*) AS cantidad
      FROM activos
      WHERE deleted_at IS NULL
      GROUP BY tipo_dispositivo
      ORDER BY cantidad DESC
    `),
    query(`
      SELECT estado, COUNT(*) AS cantidad
      FROM activos
      WHERE deleted_at IS NULL
      GROUP BY estado
    `),
    query(`
      SELECT
        c.nombre AS colaborador,
        c.area,
        COUNT(a.serie) AS total_equipos
      FROM colaboradores c
      INNER JOIN activos a ON a.rut_responsable = c.rut
      WHERE a.estado = 'Asignado' 
        AND a.deleted_at IS NULL 
        AND c.deleted_at IS NULL
      GROUP BY c.rut, c.nombre, c.area
      ORDER BY total_equipos DESC
      LIMIT 5
    `),
    query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS mes,
        COUNT(*) AS total
      FROM historial_activos
      WHERE tipo_movimiento = 'asignacion'
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY mes
      ORDER BY mes ASC
    `),
    query(`
      SELECT imei, COUNT(*) AS cantidad, array_agg(serie) AS series
      FROM activos
      WHERE imei IS NOT NULL AND TRIM(imei) != ''
        AND deleted_at IS NULL
        AND estado != 'Descartado'
      GROUP BY imei
      HAVING COUNT(*) > 1
    `),
    query(`
      SELECT numero_sim, COUNT(*) AS cantidad, array_agg(serie) AS series
      FROM activos
      WHERE numero_sim IS NOT NULL AND TRIM(numero_sim) != ''
        AND deleted_at IS NULL
        AND estado != 'Descartado'
      GROUP BY numero_sim
      HAVING COUNT(*) > 1
    `),
  ]);

  return {
    totales: totales.rows[0],
    porTipo: porTipo.rows,
    porEstado: porEstado.rows,
    topColaboradores: topColaboradores.rows,
    actividadMensual: actividadMensual.rows,
    duplicados: {
      imeis: duplicadosImeis.rows,
      sims: duplicadosSims.rows,
    }
  };
};



// =============================================
// ÁREAS (LISTA MAESTRA)
// =============================================

const getAreas = async () => {
  const { rows } = await query('SELECT * FROM areas ORDER BY nombre ASC');
  return rows;
};

const createArea = async (nombre) => {
  const { rows } = await query(
    'INSERT INTO areas (nombre) VALUES ($1) RETURNING *',
    [nombre]
  );
  return rows[0];
};

const updateArea = async (id, nombre) => {
  const { rows } = await query(
    'UPDATE areas SET nombre = $1 WHERE id = $2 RETURNING *',
    [nombre, id]
  );
  return rows[0];
};

const deleteArea = async (id) => {
  await query('DELETE FROM areas WHERE id = $1', [id]);
};

// =============================================
// EXPORTS
// =============================================

module.exports = {
  query,
  pool,
  // Usuarios
  getUsuarioByEmail,
  getUsuarios,
  createUsuario,
  updateUsuario,
  updatePasswordReset,
  resetPassword,
  // Activos
  getActivos,
  getActivoBySerie,
  createActivo,
  updateActivo,
  deleteActivo,
  // Colaboradores
  getColaboradores,
  getColaboradorByRut,
  getActivosByColaborador,
  createColaborador,
  updateColaborador,
  deleteColaborador,
  // Historial
  registrarHistorial,
  getHistorial,
  // Búsqueda
  buscarGlobal,
  // KPIs
  getKPIs,
  // Áreas
  getAreas,
  createArea,
  updateArea,
  deleteArea,
  // Pool directo (para queries custom)
  pool,
};
