// Feature: mejora-integral-inventario, Property 30: Enmascaramiento de secretos en logs
const fc = require('fast-check');
const { maskSensitive, SENSITIVE_KEYS } = require('../lib/logger');

const MASK = '***';

describe('maskSensitive - Property 30: Enmascaramiento de secretos en logs', () => {
  // Valores en claro suficientemente distintivos como para detectarlos si se
  // filtran a la salida serializada del log. Se evita el valor de la máscara.
  const secretValueArb = fc
    .string({ minLength: 6, maxLength: 40 })
    .filter((s) => s !== MASK && s.trim().length > 0);

  // Genera una clave sensible en una capitalización arbitraria (case-insensitive).
  const sensitiveKeyArb = fc
    .constantFrom(...SENSITIVE_KEYS, 'password', 'token', 'authToken', 'token_confirmacion', 'reset_token')
    .chain((key) =>
      fc.constantFrom(
        key,
        key.toUpperCase(),
        key.charAt(0).toUpperCase() + key.slice(1)
      )
    );

  // Clave "inocente" que no colisiona con ninguna clave sensible conocida.
  const safeKeyArb = fc
    .string({ minLength: 1, maxLength: 12 })
    .filter((k) => !SENSITIVE_KEYS.includes(k.toLowerCase()) && k.trim().length > 0);

  test('la salida enmascarada no contiene el valor en claro de claves sensibles (≥100 iteraciones)', () => {
    fc.assert(
      fc.property(
        secretValueArb,
        sensitiveKeyArb,
        safeKeyArb,
        fc.integer({ min: 0, max: 4 }),
        (secretValue, sensitiveKey, safeKey, depth) => {
          // Construye un objeto anidado a la profundidad indicada, colocando la
          // clave sensible con el valor secreto en la capa más interna, y
          // rodeándolo de datos benignos.
          let node = {
            [safeKey]: 'valor benigno',
            lista: [1, 'texto', { [sensitiveKey]: secretValue }],
            [sensitiveKey]: secretValue,
          };
          for (let i = 0; i < depth; i++) {
            node = { anidado: node, [safeKey + i]: 'ok' };
          }

          const masked = maskSensitive(node);
          const serialized = JSON.stringify(masked);

          // El valor en claro nunca debe aparecer en la salida.
          expect(serialized.includes(secretValue)).toBe(false);
          // Y las claves sensibles deben terminar enmascaradas.
          expect(serialized.includes(MASK)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('no muta la entrada original', () => {
    const original = { password: 'superSecreto123', nombre: 'Ana' };
    const copy = { ...original };
    maskSensitive(original);
    expect(original).toEqual(copy);
  });

  test('enmascara claves sensibles sin importar la capitalización', () => {
    expect(maskSensitive({ PASSWORD: 'x' }).PASSWORD).toBe(MASK);
    expect(maskSensitive({ Token: 'y' }).Token).toBe(MASK);
    expect(maskSensitive({ reset_token: 'z' }).reset_token).toBe(MASK);
  });

  test('preserva valores no sensibles', () => {
    const result = maskSensitive({ nombre: 'Ana', edad: 30, activo: true });
    expect(result).toEqual({ nombre: 'Ana', edad: 30, activo: true });
  });
});
