// Envoltura de logging que enmascara claves sensibles antes de escribir (Req. 12.5).
// El Sistema_Inventario nunca debe registrar en logs valores de contraseñas,
// tokens de sesión ni Tokens_Confirmacion.

const SENSITIVE_KEYS = ['password', 'token', 'authtoken', 'token_confirmacion', 'reset_token'];
const MASK = '***';

const isSensitiveKey = (key) => SENSITIVE_KEYS.includes(String(key).toLowerCase());

// Recorre recursivamente objetos y arreglos reemplazando el valor de las claves
// sensibles por una máscara. No muta la entrada original.
const maskSensitive = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== 'object') return value;

  // Evita ciclos en estructuras auto-referenciadas.
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item, seen));
  }

  // Preserva Errors como un objeto plano legible (message/stack), enmascarando
  // sus propiedades enumerables si contienen claves sensibles.
  if (value instanceof Error) {
    const errObj = { name: value.name, message: value.message, stack: value.stack };
    for (const key of Object.keys(value)) {
      errObj[key] = isSensitiveKey(key) ? MASK : maskSensitive(value[key], seen);
    }
    return errObj;
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? MASK : maskSensitive(val, seen);
  }
  return result;
};

// Aplica el enmascarado a cada argumento recibido por el logger.
const maskArgs = (args) => args.map((arg) => maskSensitive(arg));

const logger = {
  info: (...args) => console.info(...maskArgs(args)),
  warn: (...args) => console.warn(...maskArgs(args)),
  error: (...args) => console.error(...maskArgs(args)),
};

module.exports = logger;
module.exports.maskSensitive = maskSensitive;
module.exports.SENSITIVE_KEYS = SENSITIVE_KEYS;
