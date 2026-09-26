/**
 * lib/paginate.js
 * Normalización de parámetros de paginación y construcción de metadatos.
 *
 * Contrato (Req. 9.2, 9.3):
 * - pageSize por defecto 50, techo 200, piso 1.
 * - page mínimo 1.
 * - Página fuera de rango → data vacío con el total real (Req. 9.3);
 *   este módulo solo calcula limit/offset/meta, la consulta usa el total real.
 */

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MIN_PAGE_SIZE = 1;

/**
 * Normaliza los parámetros de paginación de un query string.
 *
 * @param {object} [query] - Objeto de query (ej. req.query). Puede vender ausente.
 * @param {string|number} [query.page] - Página solicitada (1-indexada).
 * @param {string|number} [query.pageSize] - Tamaño de página solicitado.
 * @returns {{ limit: number, offset: number, page: number, size: number }}
 */
function parsePagination(query = {}) {
  // parseInt(undefined|"" |"abc", 10) → NaN → || activa el default 50.
  let size = parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE; // default 50
  // Piso 1, techo 200. Un pageSize negativo o 0 cae a NaN o al piso.
  size = Math.min(Math.max(size, MIN_PAGE_SIZE), MAX_PAGE_SIZE);

  // page mínimo 1; valores no numéricos, negativos o 0 caen a 1.
  const page = Math.max(parseInt(query.page, 10) || 1, 1);

  return {
    limit: size,
    offset: (page - 1) * size,
    page,
    size,
  };
}

/**
 * Construye el objeto de metadatos de paginación para la respuesta.
 *
 * @param {number} total - Total de registros existentes que cumplen el filtro.
 * @param {number} page - Página actual (ya normalizada).
 * @param {number} size - Tamaño de página (ya normalizado).
 * @returns {{ page: number, pageSize: number, total: number, totalPages: number }}
 */
function buildPaginationMeta(total, page, size) {
  const safeTotal = Math.max(parseInt(total, 10) || 0, 0);
  const safeSize = Math.max(parseInt(size, 10) || DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);

  return {
    page: safePage,
    pageSize: safeSize,
    total: safeTotal,
    totalPages: Math.ceil(safeTotal / safeSize),
  };
}

module.exports = {
  parsePagination,
  buildPaginationMeta,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
};
