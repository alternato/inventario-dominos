const fc = require('fast-check');
const { createColaboradorSchema, createActivoSchema, validarRut } = require('../schemas');

describe('validarRut', () => {
  test('1-9 es válido', () => expect(validarRut('1-9')).toBe(true));
  test('6-K es válido', () => expect(validarRut('6-K')).toBe(true));
  test('12345678-5 es válido', () => expect(validarRut('12345678-5')).toBe(true));
  test('DV incorrecto falla', () => expect(validarRut('12345678-0')).toBe(false));
  test('sin guion falla', () => expect(validarRut('123456785')).toBe(false));
  test('vacío falla', () => expect(validarRut('')).toBe(false));
});

describe('createColaboradorSchema', () => {
  const base = { rut: '1-9', nombre: 'Test User', area: 'TI' };

  test('datos válidos pasan', () => {
    const r = createColaboradorSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  test('RUT con DV incorrecto falla', () => {
    const r = createColaboradorSchema.safeParse({ ...base, rut: '12345678-0' });
    expect(r.success).toBe(false);
    expect(r.error.errors[0].message).toMatch(/inválido/i);
  });

  test('nombre vacío falla', () => {
    const r = createColaboradorSchema.safeParse({ ...base, nombre: '' });
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Property-Based Tests (fast-check, ≥100 iteraciones)
// ─────────────────────────────────────────────────────────────

// Campos obligatorios del Activo y el fragmento de mensaje que Zod produce
// cuando cada uno falta (definidos en createActivoSchema de backend/schemas.js).
const CAMPOS_OBLIGATORIOS = {
  serie: 'Serie requerida',
  marca: 'Marca requerida',
  modelo: 'Modelo requerido',
  estado: 'Estado requerido',
  tipo_dispositivo: 'Tipo de dispositivo requerido',
};

const CAMPOS_KEYS = Object.keys(CAMPOS_OBLIGATORIOS);

// Un Activo completo y válido usado como base antes de omitir campos.
const activoBaseValido = {
  serie: 'SN-0001',
  marca: 'Dell',
  modelo: 'Latitude 5490',
  estado: 'Disponible',
  tipo_dispositivo: 'Laptop',
};

describe('Property 1: Rechazo de campos obligatorios faltantes en Activo', () => {
  // Feature: mejora-integral-inventario, Property 1: Rechazo de campos obligatorios faltantes en Activo
  // Para todo Activo al que se le omite al menos un Campo_Obligatorio,
  // createActivoSchema.safeParse falla (equivalente a un 400) y el conjunto de
  // mensajes de error nombra cada uno de los campos faltantes.
  // Validates: Requirements 1.4
  test('safeParse falla y el mensaje nombra cada campo obligatorio omitido', () => {
    fc.assert(
      fc.property(
        // Subconjunto no vacío de campos obligatorios a omitir.
        fc
          .subarray(CAMPOS_KEYS, { minLength: 1, maxLength: CAMPOS_KEYS.length })
          .filter((arr) => arr.length >= 1),
        (omitidos) => {
          // Construir el Activo omitiendo los campos seleccionados.
          const activo = { ...activoBaseValido };
          for (const campo of omitidos) delete activo[campo];

          const result = createActivoSchema.safeParse(activo);

          // Debe fallar (el middleware validate() lo traduce a un 400).
          expect(result.success).toBe(false);

          // El conjunto de mensajes debe nombrar cada campo faltante.
          const mensajes = result.error.errors.map((e) => e.message).join('. ');
          for (const campo of omitidos) {
            expect(mensajes).toContain(CAMPOS_OBLIGATORIOS[campo]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Calcula el dígito verificador correcto (mód 11) para un cuerpo numérico.
function dvEsperado(body) {
  const digits = String(body).split('').reverse();
  let sum = 0;
  let factor = 2;
  for (const d of digits) {
    sum += parseInt(d, 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const expected = 11 - (sum % 11);
  return expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
}

const DV_ALFABETO = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'K'];

describe('Property 3: Validación de RUT por dígito verificador', () => {
  // Feature: mejora-integral-inventario, Property 3: Validación de RUT por dígito verificador
  // Para todo cuerpo de RUT y todo dígito verificador candidato, validarRut
  // acepta el RUT si y solo si el DV coincide con el esperado por el algoritmo
  // mód 11; en cualquier otro caso lo rechaza (equivalente a un 400).
  // Validates: Requirements 2.2
  test('acepta si y solo si el dígito verificador es el correcto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999999 }), // cuerpo del RUT (1 a 8 dígitos)
        fc.constantFrom(...DV_ALFABETO), // DV candidato (correcto o incorrecto)
        (body, dvCandidato) => {
          const rut = `${body}-${dvCandidato}`;
          const dvCorrecto = dvEsperado(body);

          const esperado = dvCandidato === dvCorrecto;
          expect(validarRut(rut)).toBe(esperado);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: mejora-integral-inventario, Property 3: Validación de RUT por dígito verificador
  // Refuerzo: el DV correcto siempre es aceptado y cualquier DV distinto del
  // correcto siempre es rechazado, para cuerpos arbitrarios.
  // Validates: Requirements 2.2
  test('DV correcto se acepta y todo DV distinto se rechaza', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99999999 }), (body) => {
        const dvCorrecto = dvEsperado(body);

        // El RUT con el DV correcto es aceptado.
        expect(validarRut(`${body}-${dvCorrecto}`)).toBe(true);

        // Cualquier otro DV del alfabeto es rechazado.
        for (const dv of DV_ALFABETO) {
          if (dv !== dvCorrecto) {
            expect(validarRut(`${body}-${dv}`)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
