const { query } = require('./pool');

const buscarGlobal = async (q) => {
  const escaped = q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  const termino = `%${escaped}%`;

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
    ),
  ]);

  return {
    activos: activosResult.rows,
    colaboradores: colaboradoresResult.rows,
  };
};

module.exports = { buscarGlobal };
