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

/**
 * Registra un `jti` en la denylist de sesiones revocadas (Req. 11.5).
 * Idempotente: si el `jti` ya existe, no falla ni duplica.
 * @param {string} jti - Identificador único del token a revocar.
 * @param {Date} expiraAt - Momento de expiración natural del token.
 */
const revocarSesion = async (jti, expiraAt) => {
  await query(
    `INSERT INTO sesiones_revocadas (jti, expira_at)
     VALUES ($1, $2)
     ON CONFLICT (jti) DO NOTHING`,
    [jti, expiraAt]
  );
};

/**
 * Indica si un `jti` está en la denylist de sesiones vigente (Req. 11.5).
 * Solo cuenta como revocado si la entrada aún no venció (`expira_at > NOW()`),
 * de modo que las filas caducadas no bloqueen tokens nuevos que reutilicen ids.
 * @param {string} jti - Identificador único del token a comprobar.
 * @returns {Promise<boolean>} `true` si el token está revocado y vigente.
 */
const sesionRevocada = async (jti) => {
  if (!jti) return false;
  const { rows } = await query(
    `SELECT 1 FROM sesiones_revocadas WHERE jti = $1 AND expira_at > NOW() LIMIT 1`,
    [jti]
  );
  return rows.length > 0;
};

/**
 * Elimina de la denylist las sesiones ya expiradas (Req. 11.5).
 * La expiración natural del JWT las vuelve innecesarias, así la tabla no crece
 * indefinidamente. Pensada para ejecutarse periódicamente.
 * @returns {Promise<number>} Número de filas eliminadas.
 */
const limpiarSesionesRevocadas = async () => {
  const { rowCount } = await query(
    `DELETE FROM sesiones_revocadas WHERE expira_at <= NOW()`
  );
  return rowCount;
};

module.exports = {
  getUsuarioByEmail,
  getUsuarios,
  createUsuario,
  updateUsuario,
  updatePasswordReset,
  resetPassword,
  revocarSesion,
  sesionRevocada,
  limpiarSesionesRevocadas,
};
