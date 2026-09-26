const fc = require('fast-check');
const {
  parsePagination,
  buildPaginationMeta,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} = require('../lib/paginate');

// Generador de valores "sucios" para pageSize/page: cubre ausente, no numérico,
// negativo, cero y valores por encima del techo (>200).
const rawParamArb = () =>
  fc.oneof(
    fc.constant(undefined), // ausente
    fc.constant(null),
    fc.constant(''), // vacío
    fc.string(), // no numérico ("abc", etc.)
    fc.integer({ min: -1000, max: 1000 }), // negativos, cero, positivos
    fc.integer({ min: -1000, max: 1000 }).map(String), // numérico como string
    fc.integer({ min: 201, max: 100000 }), // por encima del techo
    fc.float({ min: -1000, max: 1000, noNaN: true }), // decimales
  );

describe('parsePagination / buildPaginationMeta (propiedades)', () => {
  // Feature: mejora-integral-inventario, Property 22: Normalización del tamaño
  // de página — para todo pageSize solicitado (ausente, no numérico, negativo o
  // > 200) el tamaño efectivo cae en [1, 200], es 50 por defecto y nunca > 200.
  // Validates: Requirements 9.2
  test('Property 22: normalización del tamaño de página en [1,200] con default 50', () => {
    fc.assert(
      fc.property(rawParamArb(), rawParamArb(), (pageSize, page) => {
        const { size, limit, offset } = parsePagination({ pageSize, page });

        // Rango [1, 200].
        expect(size).toBeGreaterThanOrEqual(MIN_PAGE_SIZE);
        expect(size).toBeLessThanOrEqual(MAX_PAGE_SIZE);
        expect(size).toBeLessThanOrEqual(200);
        expect(size).toBeGreaterThanOrEqual(1);

        // limit refleja el size normalizado; offset nunca negativo.
        expect(limit).toBe(size);
        expect(offset).toBeGreaterThanOrEqual(0);

        const parsed = parseInt(pageSize, 10);
        // Default 50 cuando no se solicita un tamaño válido: ausente, no numérico
        // (NaN) o cero (valor "falsy" que activa el default del contrato).
        if (Number.isNaN(parsed) || parsed === 0) {
          expect(size).toBe(DEFAULT_PAGE_SIZE);
          expect(size).toBe(50);
        }
        // Valor numérico negativo → se ajusta al piso mínimo 1.
        if (!Number.isNaN(parsed) && parsed < 0) {
          expect(size).toBe(MIN_PAGE_SIZE);
        }
        // Valor por encima del techo → se ajusta a 200.
        if (!Number.isNaN(parsed) && parsed > MAX_PAGE_SIZE) {
          expect(size).toBe(MAX_PAGE_SIZE);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: mejora-integral-inventario, Property 23: Página fuera de rango
  // devuelve vacío con total real — para todo conjunto de resultados y toda
  // página solicitada mayor que totalPages, la respuesta contiene lista vacía
  // junto con el total real de registros existentes.
  // Validates: Requirements 9.3
  test('Property 23: página fuera de rango → data vacío con total real', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }), // total real de registros
        rawParamArb(), // pageSize arbitrario
        fc.integer({ min: 1, max: 100000 }), // página "extra" fuera de rango
        (total, pageSize, extraPages) => {
          const meta = buildPaginationMeta(total, 1, parsePagination({ pageSize }).size);
          const { size } = parsePagination({ pageSize });

          // Página solicitada estrictamente mayor al número total de páginas.
          const requestedPage = meta.totalPages + extraPages;
          const { offset, page } = parsePagination({ page: requestedPage, pageSize });

          // Simula el corte que hace la consulta: slice de un dataset de tamaño `total`.
          const dataset = Array.from({ length: total }, (_, i) => i);
          const data = dataset.slice(offset, offset + size);

          // Fuera de rango ⇒ la porción devuelta es vacía.
          expect(data).toEqual([]);
          expect(data.length).toBe(0);

          // El meta reporta el total real de registros existentes.
          const outMeta = buildPaginationMeta(total, page, size);
          expect(outMeta.total).toBe(total);
        },
      ),
      { numRuns: 100 },
    );
  });
});
