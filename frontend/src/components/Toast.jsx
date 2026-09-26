import { CheckCircle2, AlertCircle, X } from 'lucide-react';

/**
 * Toast: tarjeta individual de retroalimentación (Req. 5.1, 5.2).
 *
 * Renderiza un mensaje de éxito o de error. Cuando la entidad afectada se
 * conoce, resalta su identificador visible (serie, RUT...) para que el operador
 * sepa exactamente qué registro fue afectado. Los mensajes de error se muestran
 * legibles tal cual llegan del hook (que ya extrae la causa reportada por la API).
 *
 * Accesibilidad: los toasts de éxito usan role="status" (aria-live polite) y los
 * de error role="alert" (aria-live assertive), de modo que los lectores de
 * pantalla anuncien el resultado de la operación.
 *
 * @param {object} props
 * @param {'success'|'error'} props.type
 * @param {string} props.message - Texto legible del resultado.
 * @param {string} [props.entity] - Tipo de entidad (Activo, Colaborador...).
 * @param {string} [props.identifier] - Identificador visible de la entidad.
 * @param {() => void} [props.onClose] - Handler para descartar el toast.
 */
export const Toast = ({ type = 'success', message, entity, identifier, onClose }) => {
  const isError = type === 'error';

  const styles = isError
    ? {
        container: 'bg-red-50 border-red-200 text-red-800',
        icon: 'text-red-500',
        Icon: AlertCircle,
        close: 'text-red-400 hover:text-red-600 focus:ring-red-400',
      }
    : {
        container: 'bg-green-50 border-green-200 text-green-800',
        icon: 'text-green-600',
        Icon: CheckCircle2,
        close: 'text-green-500 hover:text-green-700 focus:ring-green-500',
      };

  const { Icon } = styles;
  const tieneEntidad = !!(entity || identifier);

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-start gap-3 w-full max-w-sm p-4 rounded-lg border shadow-lg ${styles.container}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${styles.icon}`} aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{message}</p>
        {tieneEntidad && (
          <p className="text-xs mt-0.5 opacity-80 break-words">
            {entity ? `${entity} ` : ''}
            {identifier && <span className="font-semibold">{identifier}</span>}
          </p>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          className={`shrink-0 rounded p-0.5 outline-none focus:ring-2 ${styles.close}`}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

/**
 * ToastContainer: región fija que apila los toasts activos.
 *
 * Se usa junto al hook `useFeedback`:
 *   const { toasts, dismiss } = useFeedback();
 *   <ToastContainer toasts={toasts} onDismiss={dismiss} />
 *
 * Expone aria-live="polite" a nivel de región para anunciar cambios de la cola.
 *
 * @param {object} props
 * @param {Array<{id:string,type:string,message:string,entity?:string,identifier?:string}>} props.toasts
 * @param {(id: string) => void} [props.onDismiss]
 */
export const ToastContainer = ({ toasts = [], onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          type={t.type}
          message={t.message}
          entity={t.entity}
          identifier={t.identifier}
          onClose={onDismiss ? () => onDismiss(t.id) : undefined}
        />
      ))}
    </div>
  );
};

export default Toast;
