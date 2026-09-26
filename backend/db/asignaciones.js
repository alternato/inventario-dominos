/**
 * db/asignaciones.js
 *
 * Módulo transaccional que centraliza el ciclo de vida completo de las
 * Asignaciones (Req. 6, 7, 8, 14). Toda la lógica de creación, cierre y
 * confirmación de firma vive aquí, dentro de transacciones `BEGIN`/`COMMIT`/
 * `ROLLBACK`, para garantizar atomicidad y consistencia estado/asignación.
 *
 * Convenciones seguidas de la capa `db/` existente:
 *  - Consultas parametrizadas `$1..$n` (Req. 12.2).
 *  - Errores de negocio expresados con `ApiError` (Req. 13.2).
 *  - Historial registrado en `historial_activos` con los mismos campos que el
 *    resto del sistema (serie, rut_anterior, rut_nuevo, estado_anterior,
 *    estado_nuevo, tipo_movimiento, notas, usuario_id).
 */

const crypto = require('crypto');
const { pool } = require('./pool');
const { ApiError } = require('../lib/apiError');
const { parsePagination } = require('../lib/paginate');

// Vigencia del Token_Confirmacion: 72 horas (Req. 8.3).
const TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

// Código de PostgreSQL para violación de restricción única.
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Crea una Asignacion de forma atómica (Req. 7.1, 7.2, 7.3, 7.4, 14.1).
 *
 * Flujo transaccional:
 *  1. BEGIN
 *  2. SELECT ... FOR UPDATE sobre el activo (evita carreras de doble asignación).
 *  3. Validar existencia de activo y colaborador (404 si falta alguno).
 *  4. Rechazar si ya existe una asignación `activa` (409). La violación del
 *     índice único parcial `uq_asig_una_activa` también se traduce a 409.
 *  5. INSERT asignaciones (estado='activa'), UPDATE activos, INSERT historial.
 *  6. COMMIT.
 * Ante cualquier excepción: ROLLBACK y re-lanzar. `client.release()` siempre.
 *
 * @param {object} datos
 * @param {string} datos.serie_activo
 * @param {string} datos.rut_colaborador
 * @param {string} [datos.entregado_por]
 * @param {string} [datos.notas]
 * @param {number} [datos.usuario_id]
 * @returns {Promise<object>} la asignación creada.
 */
const crearAsignacion = async ({ serie_activo, rut_colaborador, entregado_por, notas, usuario_id } = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloqueo de la fila del activo para serializar asignaciones concurrentes.
    const { rows: [activo] } = await client.query(
      `SELECT * FROM activos WHERE serie = $1 AND deleted_at IS NULL FOR UPDATE`,
      [serie_activo]
    );
    const { rows: [colaborador] } = await client.query(
      `SELECT * FROM colaboradores WHERE rut = $1 AND deleted_at IS NULL LIMIT 1`,
      [rut_colaborador]
    );

    if (!activo && !colaborador) {
      throw ApiError.notFound('No existe el activo ni el colaborador indicados');
    }
    if (!activo) {
      throw ApiError.notFound(`No existe un activo con serie ${serie_activo}`);
    }
    if (!colaborador) {
      throw ApiError.notFound(`No existe un colaborador con RUT ${rut_colaborador}`);
    }

    // Rechazo explícito si ya hay una asignación activa (Req. 7.1).
    const { rows: activas } = await client.query(
      `SELECT id FROM asignaciones WHERE serie_activo = $1 AND estado = 'activa'`,
      [serie_activo]
    );
    if (activas.length > 0) {
      throw ApiError.conflict('El equipo ya está asignado');
    }

    let asignacion;
    try {
      const { rows: [creada] } = await client.query(
        `INSERT INTO asignaciones
           (serie_activo, rut_colaborador, entregado_por, notas, usuario_id, estado, fecha_inicio, created_at)
         VALUES ($1, $2, $3, $4, $5, 'activa', NOW(), NOW())
         RETURNING *`,
        [serie_activo, rut_colaborador, entregado_por || null, notas || null, usuario_id || null]
      );
      asignacion = creada;
    } catch (err) {
      // Blindaje de último recurso: el índice único parcial `uq_asig_una_activa`
      // rechaza una segunda fila activa aunque la comprobación anterior fallara.
      if (err && err.code === PG_UNIQUE_VIOLATION) {
        throw ApiError.conflict('El equipo ya está asignado');
      }
      throw err;
    }

    await client.query(
      `UPDATE activos SET estado = 'Asignado', rut_responsable = $1, updated_at = NOW()
       WHERE serie = $2`,
      [rut_colaborador, serie_activo]
    );

    await client.query(
      `INSERT INTO historial_activos
         (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id, created_at)
       VALUES ($1, NULL, $2, $3, 'Asignado', 'asignacion', $4, $5, NOW())`,
      [serie_activo, rut_colaborador, activo.estado, notas || null, usuario_id || null]
    );

    await client.query('COMMIT');
    return asignacion;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cierra una Asignacion `activa` de forma atómica (Req. 8.1, 8.2, 8.3, 8.4,
 * 14.2, 14.4, 14.5).
 *
 * Flujo transaccional:
 *  1. BEGIN
 *  2. Validar que exista una asignación `activa` para la serie/id (404 si no).
 *  3. Determinar destino de correo: correo del colaborador o `correo_alterno`.
 *     - Con correo → estado `pendiente_firma` + token con vigencia 72h.
 *     - Sin correo → estado `cerrada` sin token (no requiere firma).
 *  4. UPDATE asignaciones (fecha_fin, motivo, estado físico, token, estado).
 *  5. UPDATE activos dejando `rut_responsable` nulo y el estado físico registrado.
 *  6. INSERT historial (tipo='devolucion').
 *  7. Si `desvincular_colaborador` → UPDATE colaboradores SET activo=false.
 *  8. COMMIT.
 * Ante cualquier excepción: ROLLBACK y re-lanzar. `client.release()` siempre.
 *
 * @param {object} datos
 * @param {number} [datos.id] - Id de la asignación a cerrar.
 * @param {string} [datos.serie_activo] - Alternativa al id: serie del activo.
 * @param {string} [datos.motivo_devolucion]
 * @param {string} [datos.estado_fisico_devolucion] - Estado físico al devolver.
 * @param {boolean} [datos.desvincular_colaborador]
 * @param {string} [datos.correo_alterno]
 * @param {number} [datos.usuario_id]
 * @returns {Promise<object>} `{ asignacion, token, emailDestino }`.
 */
const cerrarAsignacion = async ({
  id,
  serie_activo,
  motivo_devolucion,
  estado_fisico_devolucion,
  desvincular_colaborador,
  correo_alterno,
  usuario_id,
} = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Localizar la asignación activa (por id o por serie) junto al correo del
    // colaborador, bloqueando la fila para evitar cierres concurrentes.
    let asignacion;
    if (id != null) {
      const { rows: [row] } = await client.query(
        `SELECT a.*, c.correo AS colaborador_correo
         FROM asignaciones a
         JOIN colaboradores c ON a.rut_colaborador = c.rut
         WHERE a.id = $1 AND a.estado = 'activa'
         FOR UPDATE OF a`,
        [id]
      );
      asignacion = row;
    } else {
      const { rows: [row] } = await client.query(
        `SELECT a.*, c.correo AS colaborador_correo
         FROM asignaciones a
         JOIN colaboradores c ON a.rut_colaborador = c.rut
         WHERE a.serie_activo = $1 AND a.estado = 'activa'
         FOR UPDATE OF a`,
        [serie_activo]
      );
      asignacion = row;
    }

    if (!asignacion) {
      throw ApiError.notFound('No existe una asignación activa para cerrar');
    }

    const nuevoEstadoFisico = estado_fisico_devolucion || 'Disponible';

    // Generación condicional del Token_Confirmacion (Req. 8.3, 8.4).
    const emailDestino = asignacion.colaborador_correo || correo_alterno || null;
    let tokenConfirmacion = null;
    let tokenExpiraAt = null;
    let estadoAsignacion = 'cerrada';
    let confirmadoVia = null;

    if (emailDestino) {
      tokenConfirmacion = crypto.randomBytes(32).toString('hex');
      tokenExpiraAt = new Date(Date.now() + TOKEN_TTL_MS);
      estadoAsignacion = 'pendiente_firma';
      confirmadoVia = asignacion.colaborador_correo ? 'corporativo' : 'alterno';
    }

    const { rows: [asignacionCerrada] } = await client.query(
      `UPDATE asignaciones SET
         fecha_fin = NOW(),
         motivo_devolucion = $1,
         estado_fisico_devolucion = $2,
         desvincular_colaborador = $3,
         token_confirmacion = $4,
         token_expira_at = $5,
         confirmado_via = $6,
         estado = $7
       WHERE id = $8
       RETURNING *`,
      [
        motivo_devolucion || null,
        nuevoEstadoFisico,
        !!desvincular_colaborador,
        tokenConfirmacion,
        tokenExpiraAt,
        confirmadoVia,
        estadoAsignacion,
        asignacion.id,
      ]
    );

    // El activo queda sin responsable con el estado físico registrado (Req. 14.2).
    await client.query(
      `UPDATE activos SET rut_responsable = NULL, estado = $1, updated_at = NOW()
       WHERE serie = $2`,
      [nuevoEstadoFisico, asignacion.serie_activo]
    );

    await client.query(
      `INSERT INTO historial_activos
         (serie, rut_anterior, rut_nuevo, estado_anterior, estado_nuevo, tipo_movimiento, notas, usuario_id, created_at)
       VALUES ($1, $2, NULL, 'Asignado', $3, 'devolucion', $4, $5, NOW())`,
      [asignacion.serie_activo, asignacion.rut_colaborador, nuevoEstadoFisico, motivo_devolucion || null, usuario_id || null]
    );

    // Desvinculación del colaborador dentro de la misma transacción (Req. 14.4).
    if (desvincular_colaborador) {
      await client.query(
        `UPDATE colaboradores SET activo = false, updated_at = NOW() WHERE rut = $1`,
        [asignacion.rut_colaborador]
      );
    }

    await client.query('COMMIT');
    return { asignacion: asignacionCerrada, token: tokenConfirmacion, emailDestino };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Confirma la Firma_Digital de una devolución a partir de un token (Req. 8.5,
 * 8.6, 8.7).
 *
 * Flujo transaccional:
 *  1. BEGIN
 *  2. Localizar la asignación por token en estado `pendiente_firma`.
 *     - Token inexistente o ya usado → 404 sin modificar estado (Req. 8.6).
 *     - Token vencido (>72h) → 410 sin modificar estado (Req. 8.7).
 *  3. Registrar `confirmado_at`, estado `cerrada` e invalidar el token
 *     (anular `token_confirmacion`) para impedir su reutilización (Req. 8.5).
 *  4. COMMIT.
 * Ante cualquier excepción: ROLLBACK y re-lanzar. `client.release()` siempre.
 *
 * @param {string} token - El Token_Confirmacion recibido por el colaborador.
 * @returns {Promise<object>} la asignación confirmada.
 */
const confirmarFirma = async (token) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloquear la fila candidata para evitar dobles confirmaciones concurrentes.
    const { rows: [asignacion] } = await client.query(
      `SELECT a.*, c.nombre AS colaborador_nombre, act.marca, act.modelo
       FROM asignaciones a
       JOIN colaboradores c ON a.rut_colaborador = c.rut
       JOIN activos act ON a.serie_activo = act.serie
       WHERE a.token_confirmacion = $1 AND a.estado = 'pendiente_firma'
       FOR UPDATE OF a`,
      [token]
    );

    // Token inexistente o ya utilizado (token anulado tras confirmar) → 404.
    if (!asignacion) {
      throw ApiError.notFound('El enlace no es válido o ya fue utilizado');
    }

    // Token vencido → 410 sin alterar el estado (Req. 8.7).
    if (asignacion.token_expira_at && new Date() > new Date(asignacion.token_expira_at)) {
      throw ApiError.gone('El enlace de confirmación expiró');
    }

    const { rows: [confirmada] } = await client.query(
      `UPDATE asignaciones SET
         confirmado_at = NOW(),
         estado = 'cerrada',
         token_confirmacion = NULL
       WHERE id = $1
       RETURNING *`,
      [asignacion.id]
    );

    await client.query('COMMIT');
    return { ...confirmada, colaborador_nombre: asignacion.colaborador_nombre, marca: asignacion.marca, modelo: asignacion.modelo };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Lista Asignaciones con filtros combinados y paginación (Req. 6.3, 9.2, 9.4,
 * 9.5).
 *
 * - Filtros por estado, serie de activo y RUT de colaborador aplicados en
 *   conjunción (AND) sobre columnas indexadas (`idx_asig_estado`,
 *   `idx_asig_serie`, `idx_asig_rut`).
 * - `LEFT JOIN` + `json_build_object` para traer colaborador y activo en una
 *   sola consulta, evitando el patrón N+1 (Req. 9.5).
 * - `COUNT(*) OVER()` para obtener el total en la misma consulta.
 * - Paginación normalizada con `parsePagination` (default 50, techo 200).
 *
 * @param {object} [filtros]
 * @param {string} [filtros.estado]
 * @param {string} [filtros.serie] - Serie del activo (alias `serie_activo`).
 * @param {string} [filtros.serie_activo]
 * @param {string} [filtros.rut] - RUT del colaborador (alias `rut_colaborador`).
 * @param {string} [filtros.rut_colaborador]
 * @param {string|number} [filtros.page]
 * @param {string|number} [filtros.pageSize]
 * @returns {Promise<{ data: object[], pagination: { page, pageSize, total, totalPages } }>}
 */
const getAsignaciones = async (filtros = {}) => {
  const { limit, offset, page, size } = parsePagination(filtros);

  const estado = filtros.estado;
  const serie = filtros.serie || filtros.serie_activo;
  const rut = filtros.rut || filtros.rut_colaborador;

  const condiciones = [];
  const params = [];
  let idx = 1;

  if (estado) { condiciones.push(`a.estado = $${idx++}`); params.push(estado); }
  if (serie) { condiciones.push(`a.serie_activo = $${idx++}`); params.push(serie); }
  if (rut) { condiciones.push(`a.rut_colaborador = $${idx++}`); params.push(rut); }

  const where = condiciones.length > 0 ? 'WHERE ' + condiciones.join(' AND ') : '';

  const { rows } = await pool.query(
    `SELECT
       a.*,
       COUNT(*) OVER() AS total_count,
       json_build_object(
         'rut', c.rut, 'nombre', c.nombre, 'correo', c.correo, 'area', c.area
       ) AS colaborador,
       json_build_object(
         'serie', act.serie, 'marca', act.marca, 'modelo', act.modelo,
         'tipo_dispositivo', act.tipo_dispositivo, 'imei', act.imei
       ) AS activo
     FROM asignaciones a
     LEFT JOIN colaboradores c ON a.rut_colaborador = c.rut
     LEFT JOIN activos act ON a.serie_activo = act.serie
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const data = rows.map((row) => {
    const rest = { ...row };
    delete rest.total_count;
    return rest;
  });

  return {
    data,
    pagination: {
      page,
      pageSize: size,
      total,
      totalPages: Math.ceil(total / size),
    },
  };
};

module.exports = {
  crearAsignacion,
  cerrarAsignacion,
  confirmarFirma,
  getAsignaciones,
};
