import { useEffect, useState } from 'react';

/**
 * Hook de debounce: colapsa ráfagas de cambios ocurridas dentro de la
 * ventana de tiempo indicada y emite únicamente el último valor recibido.
 *
 * Cada vez que `value` cambia se programa un temporizador; si `value` vuelve
 * a cambiar antes de que expire (o cambia `delay`), el temporizador anterior
 * se cancela. Así, una ráfaga de actualizaciones dentro de la ventana produce
 * una sola emisión con el valor más reciente.
 *
 * Requisitos: 10.3 — esperar 300 ms sin nuevas pulsaciones antes de emitir.
 *
 * @template T
 * @param {T} value Valor a estabilizar (p. ej. el texto de un campo de búsqueda).
 * @param {number} [delay=300] Ventana de espera en milisegundos.
 * @returns {T} El último valor tras `delay` ms sin cambios.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timerId);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedValue;
