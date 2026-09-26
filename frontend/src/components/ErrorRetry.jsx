import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * ErrorRetry: mensaje de error de red para una vista que no pudo cargar.
 * Requisitos: 15.2 — muestra un mensaje de error con un control visible
 * ("Reintentar") que reejecuta la carga de la vista.
 *
 * Es accesible: el contenedor expone role="alert" para anunciar el error a
 * lectores de pantalla, el ícono es decorativo (aria-hidden) y el botón de
 * reintento tiene un aria-label descriptivo.
 *
 * @param {string} [title] - Título del error. Por defecto "No se pudo cargar la información".
 * @param {string} [message] - Detalle legible del error de red.
 * @param {() => void} onRetry - Callback que reejecuta la carga de la vista.
 * @param {string} [retryLabel] - Etiqueta del botón de reintento. Por defecto "Reintentar".
 * @param {boolean} [isRetrying] - Si es true, deshabilita el botón y muestra el ícono girando.
 * @param {string} [className] - Clases Tailwind adicionales para el contenedor.
 */
export const ErrorRetry = ({
  title = 'No se pudo cargar la información',
  message = 'Ocurrió un error de red al cargar esta vista. Revisa tu conexión e inténtalo nuevamente.',
  onRetry,
  retryLabel = 'Reintentar',
  isRetrying = false,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
    >
      <span className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 text-red-500 mb-4">
        <AlertCircle className="w-7 h-7" aria-hidden="true" />
      </span>

      <h3 className="text-base font-semibold text-gray-900">{title}</h3>

      {message && (
        <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>
      )}

      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        aria-label={retryLabel}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold shadow-sm hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw
          className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {retryLabel}
      </button>
    </div>
  );
};

export default ErrorRetry;
