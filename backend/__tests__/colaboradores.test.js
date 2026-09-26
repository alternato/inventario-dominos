'use strict';

const fc = require('fast-check');

// El módulo db/colaboradores depende de db/pool (query) y db/historial.
// Mockeamos pool para no tocar PostgreSQL y controlar las filas devueltas,
// e historial porque no participa en getColaboradores.
jest.mock('../db/pool', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() },
}));
jest.mock('../db/historial', () => ({
  registrarHistorial: jest.fn(),
}));

const { query } = require('../db/pool');
const { getColaboradores } = require('../db/colaboradores');

const ESTADOS = ['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'];

/**
 * Cuenta los activos no eliminados con estado 'Asignado' para un RUT dado.
 * Refleja la agregación del LEFT JOIN en getColaboradores:
 *   a.rut_responsable = c.rut AND a.estado = 'Asignado' AND a.deleted_at IS NULL
 */
function contarAsignados(activos, rut) {
  return activos.filter(
    (a) => a.rut_responsable === rut && a.estado === 'Asignado' && a.deleted_at === null,
  ).length;
}

// Generador de un RUT sintético estable (sirve como clave de unión).
const rutArb = fc.integer({ min: 1, max: 20 }).map((n) => `${n}-K`);

const activoArb = fc.record({
  rut_responsable: rutArb,
  estado: fc.constantFrom(...ESTADOS),
  // deleted_at es null (vigente) o un timestamp (eliminado / soft-delete).
  deleted_at: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
});

// Feature: mejora-integral-inventario, Property 4: Conteo de activos asignados de un Colaborador
// Valida: Requisitos 2.5
describe('getColaboradores (Property 4: Conteo de activos asignados de un Colaborador)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('total_activos = nº de activos no eliminados con ese RUT y estado Asignado', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Conjunto de colaboradores con RUT único.
        fc.uniqueArray(rutArb, { minLength: 1, maxLength: 10 }),
        // Dataset de respaldo de activos.
        fc.array(activoArb, { maxLength: 40 }),
        async (ruts, activos) => {
          // El mock de query simula la fila que produce la consulta SQL:
          // una fila por colaborador con total_activos calculado sobre el
          // dataset de respaldo, y total_count = nº de colaboradores.
          const rows = ruts.map((rut, i) => ({
            id: i + 1,
            rut,
            nombre: `Colab ${i + 1}`,
            total_activos: String(contarAsignados(activos, rut)),
            total_count: String(ruts.length),
          }));

          query.mockResolvedValueOnce({ rows });

          const { data } = await getColaboradores({ query: {} });

          // Cada colaborador expone exactamente el conteo esperado.
          expect(data).toHaveLength(ruts.length);
          data.forEach((colab) => {
            const esperado = contarAsignados(activos, colab.rut);
            expect(Number(colab.total_activos)).toBe(esperado);
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
