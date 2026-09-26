import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  calcularCompletitud,
  camposRecomendados,
  esTipoMovil,
  CAMPOS_RECOMENDADOS_BASE,
  CAMPOS_RECOMENDADOS_MOVIL,
  TIPOS_MOVILES,
} from './completitud';

// Feature: mejora-integral-inventario, Property 2: Rango y monotonía del indicador de completitud

// Universo de todos los campos recomendados posibles (base + móviles), usado por los generadores.
const TODOS_LOS_CAMPOS = [...CAMPOS_RECOMENDADOS_BASE, ...CAMPOS_RECOMENDADOS_MOVIL];

// Generador de tipos de dispositivo: mezcla móviles, no móviles y variaciones de caso/espacios.
const tipoArb = fc.oneof(
  fc.constantFrom(...TIPOS_MOVILES),
  fc.constantFrom('Notebook', 'Desktop', 'Monitor', 'Impresora', 'Otro', ''),
  fc.constantFrom(' smartphone ', 'TABLET', 'sim card'),
  fc.string(),
);

// Generador del valor de un campo: valores "vacíos" (undefined/null/blancos) o "no vacíos".
const valorCampoArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constantFrom('', '   ', '\t', '\n'),
  fc.string({ minLength: 1 }).map((s) => (s.trim() === '' ? 'x' : s)),
  fc.integer(),
);

// Genera un Activo aleatorio: un tipo de dispositivo y un subconjunto arbitrario de campos con valores arbitrarios.
const activoArb = fc.record({
  tipo_dispositivo: tipoArb,
  campos: fc.dictionary(fc.constantFrom(...TODOS_LOS_CAMPOS), valorCampoArb),
}).map(({ tipo_dispositivo, campos }) => ({ tipo_dispositivo, ...campos }));

// Considera vacío igual que la implementación bajo prueba.
const estaVacio = (valor) => {
  if (valor === undefined || valor === null) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  return false;
};

describe('Property 2: Rango y monotonía del indicador de completitud', () => {
  test('el resultado siempre está en el rango [0, 100]', () => {
    fc.assert(
      fc.property(activoArb, (activo) => {
        const c = calcularCompletitud(activo);
        return Number.isInteger(c) && c >= 0 && c <= 100;
      }),
      { numRuns: 100 },
    );
  });

  test('completar un campo recomendado vacío nunca disminuye la completitud (monotonía)', () => {
    fc.assert(
      fc.property(
        activoArb,
        fc.constantFrom(...TODOS_LOS_CAMPOS),
        fc.string({ minLength: 1 }).map((s) => (s.trim() === '' ? 'valor' : s)),
        (activo, campo, valorNoVacio) => {
          const antes = calcularCompletitud(activo);
          // Rellenar (o sobrescribir) un campo con un valor garantizado no vacío.
          const despues = calcularCompletitud({ ...activo, [campo]: valorNoVacio });
          // Al no vaciar ningún campo, la completitud no puede decrecer.
          return despues >= antes;
        },
      ),
      { numRuns: 100 },
    );
  });

  test('vaciar un campo recomendado no vacío nunca aumenta la completitud (monotonía inversa)', () => {
    fc.assert(
      fc.property(activoArb, fc.constantFrom(...TODOS_LOS_CAMPOS), (activo, campo) => {
        const antes = calcularCompletitud(activo);
        const despues = calcularCompletitud({ ...activo, [campo]: '' });
        return despues <= antes;
      }),
      { numRuns: 100 },
    );
  });

  test('completar todos los campos recomendados aplicables da 100', () => {
    fc.assert(
      fc.property(tipoArb, (tipo) => {
        const aplicables = camposRecomendados(tipo);
        const activo = { tipo_dispositivo: tipo };
        for (const campo of aplicables) {
          activo[campo] = 'valor';
        }
        return calcularCompletitud(activo) === 100;
      }),
      { numRuns: 100 },
    );
  });

  test('el porcentaje coincide con la proporción de campos aplicables no vacíos', () => {
    fc.assert(
      fc.property(activoArb, (activo) => {
        const aplicables = camposRecomendados(activo.tipo_dispositivo);
        const completos = aplicables.filter((campo) => !estaVacio(activo[campo])).length;
        const esperado =
          aplicables.length === 0
            ? 100
            : Math.max(0, Math.min(100, Math.round((completos / aplicables.length) * 100)));
        return calcularCompletitud(activo) === esperado;
      }),
      { numRuns: 100 },
    );
  });

  test('los tipos móviles incluyen los campos recomendados móviles y los no móviles no', () => {
    fc.assert(
      fc.property(tipoArb, (tipo) => {
        const aplicables = camposRecomendados(tipo);
        const contieneMoviles = CAMPOS_RECOMENDADOS_MOVIL.every((c) => aplicables.includes(c));
        return esTipoMovil(tipo) ? contieneMoviles : !contieneMoviles;
      }),
      { numRuns: 100 },
    );
  });
});
