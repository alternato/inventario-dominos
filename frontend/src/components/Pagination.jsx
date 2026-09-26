import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination: controles reutilizables para listados con paginación en servidor.
 * Componente puramente presentacional; todo el estado llega por props y los
 * cambios se comunican mediante callbacks (onPageChange / onPageSizeChange).
 *
 * Es accesible: el contenedor es un <nav> con aria-label="paginación", los
 * botones exponen aria-label, el estado deshabilitado usa el atributo
 * `disabled` y el selector de tamaño de página tiene una etiqueta asociada.
 *
 * Si no hay registros (total === 0) no renderiza nada (retorna null).
 *
 * @param {number} page - Página actual (1-indexada).
 * @param {number} pageSize - Cantidad de registros por página.
 * @param {number} total - Total de registros disponibles.
 * @param {number} totalPages - Total de páginas disponibles.
 * @param {(page: number) => void} onPageChange - Callback al cambiar de página.
 * @param {(pageSize: number) => void} [onPageSizeChange] - Callback al cambiar el tamaño de página. Si se omite, no se muestra el selector.
 * @param {number[]} [pageSizeOptions] - Opciones de tamaño de página. Por defecto [50, 100, 200].
 * @param {string} [className] - Clases Tailwind adicionales para el contenedor.
 */
export const Pagination = ({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100, 200],
  className = '',
}) => {
  const selectId = useId();

  if (!total || total <= 0) {
    return null;
  }

  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  const enPrimera = page <= 1;
  const enUltima = page >= totalPages;

  const irAnterior = () => {
    if (!enPrimera) onPageChange(page - 1);
  };

  const irSiguiente = () => {
    if (!enUltima) onPageChange(page + 1);
  };

  const mostrarSelector = typeof onPageSizeChange === 'function';

  return (
    <nav
      aria-label="paginación"
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
    >
      <p className="text-sm text-gray-600">
        Mostrando{' '}
        <span className="font-semibold text-gray-900">
          {desde}–{hasta}
        </span>{' '}
        de <span className="font-semibold text-gray-900">{total}</span>
      </p>

      <div className="flex items-center gap-3">
        {mostrarSelector && (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="text-sm text-gray-600">
              Por página
            </label>
            <select
              id={selectId}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {pageSizeOptions.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={irAnterior}
            disabled={enPrimera}
            aria-label="Página anterior"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            Anterior
          </button>

          <span className="text-sm text-gray-600 whitespace-nowrap">
            Página <span className="font-semibold text-gray-900">{page}</span>{' '}
            de <span className="font-semibold text-gray-900">{totalPages}</span>
          </span>

          <button
            type="button"
            onClick={irSiguiente}
            disabled={enUltima}
            aria-label="Página siguiente"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Pagination;
