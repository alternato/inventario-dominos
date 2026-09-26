const { query } = require('./pool');
const { registrarHistorial } = require('./historial');
const { desactivarColaborador, getColaboradorByRut } = require('./colaboradores');
const { crearAsignacion, cerrarAsignacion } = require('./asignaciones');
const { esInconsistente } = require('../lib/consistencia');
const { parsePagination, buildPaginationMeta } = require('../lib/paginate');
const mail = require('../mail');

/**
 * Listado paginado de activos (Req. 9.2, 9.3, 9.4, 9.5).
 *
 * - Paginación normalizada con parsePagination (default 50, techo 200).
 * - Filtros resueltos sobre columnas indexadas: estado, tipo_dispositivo,
 *   rut_responsable e imei (Req. 9.4). La búsqueda `q` usa LOWER(serie/modelo)
 *   con índices trigram (Req. 9.4).
 * - Asignación vigente traída con un único LEFT JOIN LATERAL sobre asignaciones
 *   (estado 'activa'), evitando el patrón N+1 (Req. 9.5).
 * - Total calculado con COUNT(*) OVER() en la misma consulta (un solo round-trip).
 * - Orden por created_at DESC.
 *
 * @param {object} [filtros] - Query params (ej. req.query): page, pageSize,
 *   estado, tipo_dispositivo, rut_responsable, q.
 * @returns {Promise<{ data: object[], pagination: object }>}
 */
const getActivos = async (filtros = {}) => {
  const { limit, offset, page, size } = parsePagination(filtros);

  const conditions = ['a.deleted_at IS NULL'];
  const params = [];

  if (filtros.estado) {
    params.push(filtros.estado);
    conditions.push(`a.estado = $${params.length}`);
  }
  if (filtros.tipo_dispositivo) {
    params.push(filtros.tipo_dispositivo);
    conditions.push(`a.tipo_dispositivo = $${params.length}`);
  }
  if (filtros.rut_responsable) {
    params.push(filtros.rut_responsable);
    conditions.push(`a.rut_responsable = $${params.length}`);
  }
  if (filtros.q) {
    const escaped = String(filtros.q).toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
    params.push(`%${escaped}%`);
    conditions.push(`(LOWER(a.serie) LIKE $${params.length} OR LOWER(a.modelo) LIKE $${params.length})`);
  }

  const whereClause = conditions.join(' AND ');

  // COUNT(*) OVER() entrega el total sin un round-trip adicional (Req. 9.3).
  // LEFT JOIN LATERAL trae la asignación vigente en una sola consulta (Req. 9.5).
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const { rows } = await query(
    `SELECT
       a.*,
       json_build_object('nombre', c.nombre, 'correo', c.correo, 'area', c.area) AS colaborador,
       asig.id AS asignacion_id,
       asig.rut_colaborador AS asignacion_rut_colaborador,
       asig.fecha_inicio AS asignacion_fecha_inicio,
       COUNT(*) OVER() AS total_count
     FROM activos a
     LEFT JOIN colaboradores c ON a.rut_responsable = c.rut AND c.deleted_at IS NULL
     LEFT JOIN LATERAL (
       SELECT asig.id, asig.rut_colaborador, asig.fecha_inicio
       FROM asignaciones asig
       WHERE asig.serie_activo = a.serie AND asig.estado = 'activa'
       ORDER BY asig.fecha_inicio DESC
       LIMIT 1
     ) asig ON TRUE
     WHERE ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const data = rows.map(({ total_count: _total_count, ...activo }) => activo);

  return {
    data,
    pagination: buildPaginationMeta(total, page, size),
  };
};

const getActivoBySerie = async (serie) => {
  const { rows } = await query(
    `SELECT
       a.*,
       json_build_object('nombre', c.nombre, 'correo', c.correo) AS colaborador,
       EXISTS (
         SELECT 1 FROM asignaciones asig
         WHERE asig.serie_activo = a.serie AND asig.estado = 'activa'
       ) AS asignacion_activa
     FROM activos a
     LEFT JOIN colaboradores c ON a.rut_responsable = c.rut AND c.deleted_at IS NULL
     WHERE a.serie = $1 AND a.deleted_at IS NULL
     LIMIT 1`,
    [serie]
  );
  const activo = rows[0] || null;
  if (!activo) return null;

  // Ficha_Activo: exponer inconsistencia estado/asignación (Property 33 — Req. 14.3)
  activo.inconsistente = esInconsistente({
    estado: activo.estado,
    asignacionActiva: activo.asignacion_activa,
  });
  return activo;
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
  const anterior = await getActivoBySerie(serie);

  const {
    serie: serieIngresada,
    marca, modelo, estado, tipo_dispositivo,
    rut_responsable, ubicacion, observaciones,
    fecha_compra, valor, numero_factura, imei, numero_sim, imsi,
    numero_telefono, compania,
    motivo_devolucion, desvincular_usuario, falta_firma
  } = activoData;

  let nuevaSerie = serieIngresada ? serieIngresada.trim().toUpperCase() : serie;
  nuevaSerie = nuevaSerie === '' ? serie : nuevaSerie;

  const cambioResponsable = anterior
    ? anterior.rut_responsable !== (rut_responsable || null)
    : false;
  const cambioEstado = anterior ? anterior.estado !== estado : false;

  // Cuando cambia el responsable desde la ficha, el ciclo de vida de la
  // Asignacion (cierre/creación) y la mutación de estado/responsable del Activo
  // se delegan a las funciones transaccionales de db/asignaciones.js
  // (crearAsignacion/cerrarAsignacion). Así se elimina el doble camino que
  // creaba/cerraba asignaciones fuera de transacción (Req. 14.1, 14.2, 14.5).
  //
  // El UPDATE directo sobre `activos` deja de tocar `estado`/`rut_responsable`
  // en ese caso para no pisar lo que fijan las funciones transaccionales; solo
  // persiste los campos de ficha (marca, modelo, serie, imei, etc.).
  const rows = cambioResponsable
    ? (await query(
        `UPDATE activos SET
           serie = $1, marca = $2, modelo = $3, tipo_dispositivo = $4,
           ubicacion = $5, observaciones = $6,
           fecha_compra = $7, valor = $8, numero_factura = $9,
           imei = $10, numero_sim = $11, imsi = $12,
           numero_telefono = $13, compania = $14, updated_at = NOW()
         WHERE serie = $15
         RETURNING *`,
        [
          nuevaSerie,
          marca, modelo, tipo_dispositivo,
          ubicacion || null, observaciones || null,
          fecha_compra || null, valor || null, numero_factura || null,
          imei || null, numero_sim || null, imsi || null,
          numero_telefono || null, compania || null,
          serie,
        ]
      )).rows
    : (await query(
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
          serie,
        ]
      )).rows;

  if (nuevaSerie !== serie) {
    console.log(`[updateActivo] Serie cambió de ${serie} a ${nuevaSerie}. Actualizando historial...`);
    await query(`UPDATE historial_activos SET serie = $1 WHERE serie = $2`, [nuevaSerie, serie]);
  }

  if (anterior) {
    if (cambioResponsable || cambioEstado) {
      if (cambioResponsable) {
        // Delegación transaccional: primero se cierra la asignación vigente (si
        // la hay) y luego se abre la nueva. Cada paso es atómico y deja el
        // Activo con estado/responsable e historial consistentes.
        if (anterior.rut_responsable) {
          await cerrarAsignacion({
            serie_activo: nuevaSerie,
            motivo_devolucion: motivo_devolucion || 'Edición directa de responsable',
            estado_fisico_devolucion: rut_responsable ? undefined : estado,
            usuario_id: usuarioId,
          });
        }

        if (rut_responsable) {
          await crearAsignacion({
            serie_activo: nuevaSerie,
            rut_colaborador: rut_responsable,
            notas: 'Creado automáticamente al editar responsable de activo',
            usuario_id: usuarioId,
          });
        }
      } else {
        // Solo cambió el estado (sin cambio de responsable): se conserva el
        // registro de historial de cambio de estado como antes.
        await registrarHistorial({
          serie: nuevaSerie,
          rut_anterior: anterior.rut_responsable,
          rut_nuevo: rut_responsable || null,
          estado_anterior: anterior.estado,
          estado_nuevo: estado,
          tipo_movimiento: 'cambio_estado',
          usuario_id: usuarioId,
          notas: motivo_devolucion ? `Devolución por: ${motivo_devolucion}` : null,
        });
      }

      if (desvincular_usuario && anterior.rut_responsable) {
        await desactivarColaborador(anterior.rut_responsable);
      }

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
          const activoDetalle = await getActivoBySerie(serie);
          await mail.sendStatusEventAlert(activoDetalle, anterior.estado, estado, 'informatica@dominospizza.cl');
        } catch (error) {
          console.error('[Mail] Error enviando alerta de cambio de estado:', error);
        }
      }
    }
  }

  // Si el responsable cambió, el estado/responsable finales los fijaron las
  // funciones transaccionales de asignación; se relee la fila para devolver el
  // estado real del Activo en lugar del parcial del UPDATE de ficha.
  if (cambioResponsable) {
    const { rows: actuales } = await query(
      `SELECT * FROM activos WHERE serie = $1 AND deleted_at IS NULL LIMIT 1`,
      [nuevaSerie]
    );
    return actuales[0] || rows[0];
  }

  return rows[0];
};

const deleteActivo = async (serie, usuarioId = null) => {
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

module.exports = {
  getActivos,
  getActivoBySerie,
  createActivo,
  updateActivo,
  deleteActivo,
};
