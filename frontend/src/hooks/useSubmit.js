import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Timeout por defecto para una operación en curso (Req. 5.3, 5.4): 30 segundos.
 */
export const SUBMIT_TIMEOUT_MS = 30_000;

/**
 * Mensaje emitido cuando la operación no recibe respuesta dentro del timeout (Req. 5.4).
 */
export const TIMEOUT_ERROR_MESSAGE = 'la operación no pudo confirmarse';

/**
 * Extrae un mensaje de error legible priorizando la causa reportada por la
 * API_Backend (`error.response.data.error.message`), con degradaciones razonables.
 *
 * @param {unknown} error
 * @returns {string}
 */
function toReadableError(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Ocurrió un error inesperado'
  );
}

/**
 * Hook que centraliza el ciclo de vida de una operación de escritura contra la
 * API_Backend, aplicando:
 *
 * - Indicador de carga: expone `isSubmitting` mientras la promesa está pendiente.
 * - Antirreenvío (Property 9 / Req. 5.3): mientras hay una operación en curso,
 *   cualquier disparo adicional se ignora y NO emite una nueva solicitud.
 * - Timeout de 30 s (Req. 5.3, 5.4): usa `AbortController`; al expirar retira el
 *   spinner (`isSubmitting = false`) y emite el error "la operación no pudo confirmarse".
 * - Preservación de datos (Property 8 / Req. 5.2): el hook nunca gestiona ni
 *   descarta los valores del formulario del llamador; ante un error solo expone el
 *   mensaje, dejando intacto el estado del formulario.
 *
 * El callback recibe `{ signal }` para que el llamador pueda cablear la cancelación
 * (por ejemplo `apiClient.post(url, body, { signal })`).
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs=SUBMIT_TIMEOUT_MS] Milisegundos hasta abortar.
 * @returns {{
 *   isSubmitting: boolean,
 *   error: string | null,
 *   submit: (fn: (ctx: { signal: AbortSignal }) => Promise<any>) => Promise<any>,
 *   reset: () => void,
 * }}
 */
export function useSubmit({ timeoutMs = SUBMIT_TIMEOUT_MS } = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Ref síncrona para bloquear reenvíos concurrentes sin depender del ciclo de
  // render de React (el estado `isSubmitting` se actualiza de forma asíncrona).
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const submit = useCallback(
    async (fn) => {
      // Antirreenvío: si ya hay una operación en curso, ignorar el disparo.
      if (inFlightRef.current) {
        return undefined;
      }

      inFlightRef.current = true;
      setIsSubmitting(true);
      setError(null);

      const controller = new AbortController();
      controllerRef.current = controller;

      let timedOut = false;
      timerRef.current = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const finalize = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        inFlightRef.current = false;
        controllerRef.current = null;
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
      };

      try {
        const result = await fn({ signal: controller.signal });
        finalize();
        return result;
      } catch (err) {
        finalize();
        if (mountedRef.current) {
          // Un abort provocado por el timeout se reporta como "no confirmada".
          // Cualquier otro error (incluido un abort ajeno) usa la causa legible.
          setError(timedOut ? TIMEOUT_ERROR_MESSAGE : toReadableError(err));
        }
        // Se relanza para que el llamador pueda reaccionar sin descartar el
        // estado del formulario (Property 8): la preservación depende de que el
        // llamador NO limpie sus campos en el catch.
        throw err;
      }
    },
    [timeoutMs]
  );

  return { isSubmitting, error, submit, reset };
}

export default useSubmit;
