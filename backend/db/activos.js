const { query } = require('./pool');
const { registrarHistorial } = require('./historial');
const { desactivarColaborador, getColaboradorByRut } = require('./colaboradores');
const mail = require('../mail');

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

  if (nuevaSerie !== serie) {
    console.log(`[updateActivo] Serie cambió de ${serie} a ${nuevaSerie}. Actualizando historial...`);
    await query(`UPDATE historial_activos SET serie = $1 WHERE serie = $2`, [nuevaSerie, serie]);
  }

  if (anterior) {
    const cambioResponsable = anterior.rut_responsable !== (rut_responsable || null);
    const cambioEstado = anterior.estado !== estado;

    if (cambioResponsable || cambioEstado) {
      let tipoMovimiento = 'cambio_estado';
      if (cambioResponsable && rut_responsable) tipoMovimiento = 'asignacion';
      if (cambioResponsable && !rut_responsable) tipoMovimiento = 'devolucion';

      await registrarHistorial({
        serie: nuevaSerie,
        rut_anterior: anterior.rut_responsable,
        rut_nuevo: rut_responsable || null,
        estado_anterior: anterior.estado,
        estado_nuevo: estado,
        tipo_movimiento: tipoMovimiento,
        usuario_id: usuarioId,
        notas: motivo_devolucion ? `Devolución por: ${motivo_devolucion}` : null,
      });

      if (cambioResponsable) {
        await query(
          `UPDATE asignaciones
           SET estado = 'cerrada', fecha_fin = NOW(), motivo_devolucion = $2
           WHERE serie_activo = $1 AND estado = 'activa'`,
          [nuevaSerie, motivo_devolucion || 'Edición directa de responsable']
        );

        if (rut_responsable) {
          await query(
            `INSERT INTO asignaciones (serie_activo, rut_colaborador, fecha_inicio, estado, notas, usuario_id)
             VALUES ($1, $2, NOW(), 'activa', 'Creado automáticamente al editar responsable de activo', $3)`,
            [nuevaSerie, rut_responsable, usuarioId]
          );
        }
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
