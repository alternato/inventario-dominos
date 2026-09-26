import { Inbox } from 'lucide-react';

/**
 * EmptyState: estado vacío reutilizable para listados sin registros.
 * Requisitos: 15.1, 6.4 — explica la ausencia de datos y ofrece la acción
 * principal disponible para esa sección (p. ej. asignaciones, activos o
 * colaboradores sin resultados).
 *
 * Es accesible: el contenedor expone role="status" con un aria-label
 * derivado del título/explicación, y el ícono es decorativo (aria-hidden).
 *
 * @param {React.ComponentType} [icon] - Ícono de lucide-react a mostrar. Por defecto Inbox.
 * @param {string} title - Título breve que nombra la ausencia de datos.
 * @param {string} [explanation] - Texto que explica por qué no hay datos y qué puede hacer el usuario.
 * @param {string} [actionLabel] - Etiqueta del botón de acción principal (opcional).
 * @param {() => void} [onAction] - Callback de la acción principal. La acción solo se muestra si hay actionLabel y onAction.
 * @param {string} [className] - Clases Tailwind adicionales para el contenedor.
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  explanation,
  actionLabel,
  onAction,
  className = '',
}) => {
  const mostrarAccion = Boolean(actionLabel && onAction);
  const etiqueta = explanation ? `${title}. ${explanation}` : title;

  return (
    <div
      role="status"
      aria-label={etiqueta}
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
    >
      <span className="flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-400 mb-4">
        <Icon className="w-7 h-7" aria-hidden="true" />
      </span>

      <h3 className="text-base font-semibold text-gray-900">{title}</h3>

      {explanation && (
        <p className="mt-1 max-w-md text-sm text-gray-500">{explanation}</p>
      )}

      {mostrarAccion && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
