import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumb — ruta de navegación accesible (Requisitos 4.1, 4.2, 4.3).
 *
 * Renderiza al menos dos niveles: el/los listado(s) de origen navegable(s) y el
 * detalle actual. El nivel de listado de origen conserva los filtros aplicados
 * previamente propagándolos vía `to` (query string) y/o `state` de react-router.
 *
 * Cada item admite:
 *  - label   {string}            Texto visible (obligatorio).
 *  - to      {string|object}     Destino navegable. Acepta string (`/activos?estado=Disponible`)
 *                                o el objeto de ubicación de react-router
 *                                (`{ pathname, search, hash }`). Omitir en el item actual.
 *  - state   {object}            Estado de navegación con los filtros a conservar (opcional).
 *  - onClick {function}          Handler opcional (p. ej. cerrar un modal antes de navegar).
 *
 * El último item se marca como página actual con `aria-current="page"` y no es un enlace.
 */
export const Breadcrumb = ({ items = [], className = '' }) => {
  const validItems = Array.isArray(items) ? items.filter((item) => item && item.label) : [];

  if (validItems.length < 2) {
    // Un breadcrumb requiere al menos dos niveles (origen + actual) para ser útil.
    return null;
  }

  return (
    <nav aria-label="breadcrumb" className={`text-sm ${className}`}>
      <ol className="flex flex-wrap items-center gap-1 text-gray-500">
        {validItems.map((item, index) => {
          const isLast = index === validItems.length - 1;
          const key = `${item.label}-${index}`;

          return (
            <Fragment key={key}>
              <li className="flex items-center">
                {isLast || !item.to ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={isLast ? 'font-semibold text-gray-800' : ''}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.to}
                    state={item.state}
                    onClick={item.onClick}
                    className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
