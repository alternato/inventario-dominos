'use strict';

/**
 * Campos sensibles que nunca deben incluirse en una respuesta de usuario.
 * @type {string[]}
 */
const SENSITIVE_FIELDS = ['password', 'reset_token', 'reset_token_expires'];

/**
 * Elimina los campos sensibles (`password`, `reset_token`, `reset_token_expires`)
 * de un objeto usuario. Devuelve una copia superficial sin dichos campos, sin
 * mutar el objeto original (Req. 12.4).
 *
 * Soporta tanto un objeto único como un arreglo de objetos. Cualquier otro valor
 * (null, undefined, primitivos) se devuelve sin cambios.
 *
 * @param {object|object[]|null|undefined} u - Usuario o arreglo de usuarios a sanear.
 * @returns {object|object[]|null|undefined} La entrada saneada.
 */
function sanitizeUsuario(u) {
  if (Array.isArray(u)) {
    return u.map(sanitizeUsuario);
  }

  if (u === null || typeof u !== 'object') {
    return u;
  }

  const sanitized = { ...u };
  for (const field of SENSITIVE_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

module.exports = sanitizeUsuario;
module.exports.sanitizeUsuario = sanitizeUsuario;
module.exports.SENSITIVE_FIELDS = SENSITIVE_FIELDS;
