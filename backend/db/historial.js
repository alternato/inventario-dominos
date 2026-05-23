const { query } = require('./pool');

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

module.exports = { registrarHistorial, getHistorial };
