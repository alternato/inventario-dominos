'use strict';

const fc = require('fast-check');
const sanitizeUsuario = require('../lib/sanitizeUsuario');
const { SENSITIVE_FIELDS } = require('../lib/sanitizeUsuario');

// Feature: mejora-integral-inventario, Property 29: Exclusión de datos sensibles de usuario en respuestas
// Valida: Requisitos 12.4

// Generador de valores arbitrarios simples para poblar campos de usuario.
const scalarArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
);

// Genera un objeto usuario con un conjunto arbitrario de campos "normales" y,
// opcionalmente, algunos/todos los campos sensibles.
const usuarioArb = fc
  .record({
    // Campos no sensibles habituales de un usuario.
    id: fc.integer({ min: 1, max: 100000 }),
    email: fc.emailAddress(),
    nombre: fc.string(),
    rol: fc.constantFrom('admin', 'operador', 'viewer'),
    activo: fc.boolean(),
    // Campos sensibles opcionales: cada uno puede estar presente o ausente.
    password: fc.option(scalarArb, { nil: undefined }),
    reset_token: fc.option(scalarArb, { nil: undefined }),
    reset_token_expires: fc.option(scalarArb, { nil: undefined }),
    // Otros campos arbitrarios que no deben eliminarse.
    extra: fc.option(scalarArb, { nil: undefined }),
  })
  .map((u) => {
    // Elimina las claves con valor undefined para simular presencia/ausencia real.
    const out = {};
    for (const [k, v] of Object.entries(u)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  });

describe('sanitizeUsuario (Property 29: Exclusión de datos sensibles)', () => {
  test('la salida nunca contiene campos sensibles (objeto único)', () => {
    fc.assert(
      fc.property(usuarioArb, (usuario) => {
        const result = sanitizeUsuario(usuario);
        for (const field of SENSITIVE_FIELDS) {
          expect(Object.prototype.hasOwnProperty.call(result, field)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  test('la salida nunca contiene campos sensibles (arreglo de usuarios)', () => {
    fc.assert(
      fc.property(fc.array(usuarioArb, { maxLength: 20 }), (usuarios) => {
        const result = sanitizeUsuario(usuarios);
        for (const u of result) {
          for (const field of SENSITIVE_FIELDS) {
            expect(Object.prototype.hasOwnProperty.call(u, field)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  test('preserva los campos no sensibles y no muta la entrada', () => {
    fc.assert(
      fc.property(usuarioArb, (usuario) => {
        const original = { ...usuario };
        const result = sanitizeUsuario(usuario);
        // No muta el objeto original.
        expect(usuario).toEqual(original);
        // Todo campo no sensible se conserva con su valor.
        for (const [k, v] of Object.entries(usuario)) {
          if (!SENSITIVE_FIELDS.includes(k)) {
            expect(result[k]).toEqual(v);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
