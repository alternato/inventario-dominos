const { query } = require('./pool');

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

module.exports = { getAreas, createArea, updateArea, deleteArea };
