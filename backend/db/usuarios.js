const bcrypt = require('bcryptjs');
const { query } = require('./pool');

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

module.exports = {
  getUsuarioByEmail,
  getUsuarios,
  createUsuario,
  updateUsuario,
  updatePasswordReset,
  resetPassword,
};
