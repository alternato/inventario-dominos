// Feature: mejora-integral-inventario
// Pruebas de propiedad para el historial de movimientos (getHistorial).
'use strict';

const fc = require('fast-check');

// Mock de la capa de acceso a datos (pool). getHistorial hace require('./pool').
// El mock simula lo que hace la base de datos: aplicar `ORDER BY h.created_at DESC`
// y devolver todas las columnas de la entrada (h.*), de modo que las propiedades
// verifican el contrato observable de getHistorial sobre el resultado.
jest.mock('../db/pool', () => ({
  query: jest.fn(),
}));

const { query } = require('../db/pool');
const { getHistorial } = require('../db/historial');

// Campos requeridos por Req. 3.4 en cada entrada del historial.
// Se aceptan los nombres reales de columna del esquema (tipo_movimiento/created_at).
const CAMPOS_REQUERIDOS = [
  'tipo_movimiento',
  'created_at',
  'rut_anterior',
  'rut_nuevo',
  'estado_anterior',
  'estado_nuevo',
  'notas',
];

// Generador de una entrada de movimiento arbitraria con todos los campos requeridos.
const movimientoArb = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }),
  serie: fc.string({ minLength: 1, maxLength: 12 }),
  tipo_movimiento: fc.constantFrom(
    'asignacion',
    'devolucion',
    'cambio_estado',
    'creacion',
    'baja',
    'reparacion'
  ),
  // Marca temporal arbitraria dentro de un rango amplio (epoch ms).
  created_at: fc.integer({ min: 0, max: 4_000_000_000_000 }).map((ms) => new Date(ms)),
  rut_anterior: fc.option(fc.string({ minLength: 1, maxLength: 12 }), { nil: null }),
  rut_nuevo: fc.option(fc.string({ minLength: 1, maxLength: 12 }), { nil: null }),
  estado_anterior: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  estado_nuevo: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  notas: fc.option(fc.string({ maxLength: 60 }), { nil: null }),
});

const movimientosArb = fc.array(movimientoArb, { minLength: 0, maxLength: 50 });

// Simula la respuesta de la base de datos: ordena por created_at DESC (como el SQL)
// y responde en la forma { rows } que espera getHistorial.
const configurarQueryConMovimientos = (movimientos) => {
  const ordenados = [...movimientos].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  query.mockResolvedValue({ rows: ordenados });
};

beforeEach(() => {
  query.mockReset();
});

describe('getHistorial (historial de movimientos)', () => {
  // Feature: mejora-integral-inventario, Property 5: Orden cronológico descendente del historial
  // Validates: Requirements 3.3
  test('Property 5: las entradas se devuelven en orden no creciente por fecha', async () => {
    await fc.assert(
      fc.asyncProperty(movimientosArb, async (movimientos) => {
        configurarQueryConMovimientos(movimientos);

        const resultado = await getHistorial({ serie: 'SN-TEST' });

        // Debe conservar la cantidad de filas devueltas por la base de datos.
        expect(resultado).toHaveLength(movimientos.length);

        // Orden cronológico descendente: cada fecha >= la siguiente.
        for (let i = 1; i < resultado.length; i++) {
          const anterior = new Date(resultado[i - 1].created_at).getTime();
          const actual = new Date(resultado[i].created_at).getTime();
          expect(anterior).toBeGreaterThanOrEqual(actual);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: mejora-integral-inventario, Property 6: Completitud de forma de cada entrada de historial
  // Validates: Requirements 3.4
  test('Property 6: cada entrada expone todos los campos requeridos', async () => {
    await fc.assert(
      fc.asyncProperty(movimientosArb, async (movimientos) => {
        configurarQueryConMovimientos(movimientos);

        const resultado = await getHistorial({ serie: 'SN-TEST' });

        for (const entrada of resultado) {
          for (const campo of CAMPOS_REQUERIDOS) {
            // El campo debe estar presente en la forma de la entrada (puede ser null,
            // pero la clave debe existir: es la completitud de forma que exige Req. 3.4).
            expect(Object.prototype.hasOwnProperty.call(entrada, campo)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
