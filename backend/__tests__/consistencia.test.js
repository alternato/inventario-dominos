'use strict';

const fc = require('fast-check');
const { esInconsistente, ESTADO_ASIGNADO } = require('../lib/consistencia');

// Feature: mejora-integral-inventario, Property 33: Detección de inconsistencia estado/asignación
// Valida: Requisitos 14.3

// Conjunto de estados posibles de un Activo. Solo 'Asignado' puede ser inconsistente.
const ESTADOS = ['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'];

const estadoArb = fc.constantFrom(...ESTADOS);
const asignacionActivaArb = fc.boolean();

describe('esInconsistente (Property 33: Detección de inconsistencia estado/asignación)', () => {
  test('inconsistente ⟺ estado Asignado sin asignación activa', () => {
    fc.assert(
      fc.property(estadoArb, asignacionActivaArb, (estado, asignacionActiva) => {
        const esperado = estado === ESTADO_ASIGNADO && !asignacionActiva;
        expect(esInconsistente({ estado, asignacionActiva })).toBe(esperado);
      }),
      { numRuns: 100 },
    );
  });

  test('ningún estado distinto de Asignado es inconsistente, sin importar la asignación', () => {
    const noAsignados = ESTADOS.filter((e) => e !== ESTADO_ASIGNADO);
    fc.assert(
      fc.property(
        fc.constantFrom(...noAsignados),
        asignacionActivaArb,
        (estado, asignacionActiva) => {
          expect(esInconsistente({ estado, asignacionActiva })).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
