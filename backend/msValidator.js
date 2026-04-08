// msValidator.js — Valida el id_token de Microsoft Entra ID contra las JWKs del tenant
const { createRemoteJWKSet, jwtVerify } = require('jose');

const TENANT_ID = '796cb01d-5824-4199-9177-a82623fb5e38';
const CLIENT_ID = '4361c762-9ecd-4da0-b136-dafcbb63aa7f';

const JWKS = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
);

/**
 * Verifica un id_token emitido por Microsoft Entra ID.
 * @param {string} idToken — El token que envía el frontend tras loginPopup()
 * @returns {object} payload del JWT (contiene preferred_username, email, name, etc.)
 * @throws si el token es inválido, expirado o de un tenant/audience incorrecto
 */
async function verifyMsToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    audience: CLIENT_ID,
  });
  return payload;
}

module.exports = { verifyMsToken };
