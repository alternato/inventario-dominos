import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Duración por defecto (ms) que un toast permanece visible antes de auto-descartarse.
 */
export const FEEDBACK_DEFAULT_DURATION_MS = 5_000;

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `fb-${idSeq}-${Date.now()}`;
}

/**
 * Construye un mensaje de confirmación que nombra el tipo de operación y la
 * entidad afectada por su identificador visible (Req. 5.1).
 *
 * Ejemplos:
 *   buildSuccessMessage('creado', 'Activo', 'ABC123')
 *     -> "Activo ABC123 creado correctamente."
 *   buildSuccessMessage('eliminado', 'Colaborador', '12.345.678-9')
 *     -> "Colaborador 12.345.678-9 eliminado correctamente."
 *
 * @param {string} operacion - Participio de la operación: creado | actualizado | eliminado, etc.
 * @param {string} [entidad] - Tipo de entidad (Activo, Colaborador, Asignación...).
 * @param {string} [identificador] - Identificador visible de la entidad (serie, RUT...).
 * @returns {string}
 */
export function buildSuccessMessage(operacion, entidad, identificador) {
  const partes = [entidad, identificador].filter(Boolean).join(' ');
  if (partes) {
    return `${partes} ${operacion} correctamente.`;
  }
  return `Operación ${operacion} correctamente.`;
}

/**
 * Normaliza cualquier valor de error a un texto legible para el Usuario_Operador,
 * priorizando la causa reportada por la API_Backend (Req. 5.2). No arroja ni
 * descarta datos: solo produce un string.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function toReadableError(error) {
  if (typeof error === 'string') return error;
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.error?.message ||
    error?.message ||
    'Ocurrió un error inesperado.'
  );
}

/**
 * Hook de retroalimentación de operaciones (Req. 5.1, 5.2).
 *
 * Mantiene una cola de toasts y expone helpers para encolar mensajes de éxito
 * o de error. Cada toast tiene: `id`, `type` ('success' | 'error'), `message`,
 * y opcionalmente `entity`/`identifier` para que el componente <Toast/> pueda
 * resaltar el identificador visible de la entidad afectada.
 *
 * - `success` compone un mensaje que nombra tipo de operación + entidad por su
 *   identificador visible.
 * - `error` produce un mensaje legible a partir de la causa reportada por la API;
 *   estos toasts NO se auto-descartan por defecto para que el operador pueda
 *   leerlos con calma (preservando el contexto del error), pero se pueden cerrar.
 *
 * El hook nunca gestiona los datos del formulario del llamador: solo informa.
 *
 * @param {object} [options]
 * @param {number} [options.duration=FEEDBACK_DEFAULT_DURATION_MS] Duración de los toasts de éxito.
 */
export function useFeedback({ duration = FEEDBACK_DEFAULT_DURATION_MS } = {}) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId();
      const entry = { id, ...toast };
      setToasts((prev) => [...prev, entry]);

      // Auto-descarte solo cuando hay una duración positiva. Los errores usan
      // `autoDismiss: false` por defecto para que el operador los lea.
      if (entry.autoDismiss !== false && entry.duration > 0) {
        const timer = setTimeout(() => {
          if (mountedRef.current) dismiss(id);
        }, entry.duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  /**
   * Encola un toast de éxito que identifica la operación y la entidad afectada.
   *
   * @param {object} args
   * @param {string} args.operacion - creado | actualizado | eliminado, etc.
   * @param {string} [args.entidad] - Tipo de entidad (Activo, Colaborador...).
   * @param {string} [args.identificador] - Identificador visible (serie, RUT...).
   * @param {string} [args.message] - Mensaje explícito; si se omite, se compone.
   * @param {number} [args.duration] - Duración específica en ms.
   */
  const success = useCallback(
    ({ operacion, entidad, identificador, message, duration: d } = {}) =>
      push({
        type: 'success',
        message: message || buildSuccessMessage(operacion, entidad, identificador),
        entity: entidad,
        identifier: identificador,
        duration: d ?? duration,
        autoDismiss: true,
      }),
    [push, duration]
  );

  /**
   * Encola un toast de error legible. Acepta un Error/objeto de axios o un texto.
   * Por defecto no se auto-descarta (autoDismiss=false) para preservar el contexto.
   *
   * @param {unknown} error - Error de la API_Backend, Error nativo o string.
   * @param {object} [opts]
   * @param {string} [opts.entidad] - Tipo de entidad afectada.
   * @param {string} [opts.identificador] - Identificador visible afectado.
   * @param {boolean} [opts.autoDismiss=false] - Si el toast debe auto-cerrarse.
   * @param {number} [opts.duration] - Duración en ms si autoDismiss es true.
   */
  const error = useCallback(
    (err, { entidad, identificador, autoDismiss = false, duration: d } = {}) =>
      push({
        type: 'error',
        message: toReadableError(err),
        entity: entidad,
        identifier: identificador,
        autoDismiss,
        duration: d ?? duration,
      }),
    [push, duration]
  );

  return { toasts, success, error, dismiss, clear };
}

export default useFeedback;
