const { query } = require('./pool');
const { registrarHistorial } = require('./historial');
const { parsePagination, buildPaginationMeta } = require('../lib/paginate');

/**
 * Listado paginado de colaboradores (Req. 9.2, 9.3, 9.4, 9.5, 2.5).
 *
 * - Paginación normalizada vía parsePagination (default 50, techo 200).
 * - Filtros sobre columnas indexadas: `area` (índice colaboradores(area)),
 *   `q` búsqueda por nombre/rut/correo (índice trigram sobre LOWER(nombre)).
 * - total_activos: conteo de activos asignados por colaborador, resuelto con
 *   LEFT JOIN + agregación en una sola consulta (sin N+1, Req. 9.5).
 * - total global vía COUNT(*) OVER() en la misma consulta (sin round-trip extra).
 *
 * @param {object} [opts]
 * @param {object} [opts.query] - req.query con { page, pageSize, area, q }.
 * @returns {Promise<{ data: object[], pagination: object }>}
 */
const getColaboradores = async ({ query: q = {} } = {}) => {
  const { limit, offset, page, size } = parsePagination(q);

  const filters = ['c.deleted_at IS NULL'];
  const params = [];

  if (q.area) {
    params.push(q.area);
    filters.push(`c.area = $${params.length}`);
  }

  if (q.q) {
    params.push(`%${String(q.q).toLowerCase()}%`);
    const idx = params.length;
    filters.push(`(LOWER(c.nombre) LIKE $${idx} OR LOWER(c.rut) LIKE $${idx} OR LOWER(c.correo) LIKE $${idx})`);
  }

  const whereClause = filters.join(' AND ');

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const { rows } = await query(
    `SELECT
       c.*,
       COUNT(a.serie) AS total_activos,
       COUNT(*) OVER() AS total_count
     FROM colaboradores c
     LEFT JOIN activos a ON a.rut_responsable = c.rut AND a.estado = 'Asignado' AND a.deleted_at IS NULL
     WHERE ${whereClause}
     GROUP BY c.id, c.rut
     ORDER BY c.nombre ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const data = rows.map(({ total_count: _total_count, ...rest }) => rest);

  return {
    data,
    pagination: buildPaginationMeta(total, page, size),
  };
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
