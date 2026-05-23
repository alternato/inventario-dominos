const { query } = require('./pool');
const { registrarHistorial } = require('./historial');

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

module.exports = {
  getColaboradores,
  getColaboradorByRut,
  getActivosByColaborador,
  createColaborador,
  updateColaborador,
  desactivarColaborador,
  deleteColaborador,
};
