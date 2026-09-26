import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import fc from 'fast-check';
import { useDebouncedValue } from '../useDebouncedValue';

// Feature: mejora-integral-inventario, Property 26: Debounce de búsqueda colapsa ráfagas
//
// Valida: Requisitos 10.3 — al escribir en un campo de búsqueda, la Interfaz_Web
// espera 300 ms sin nuevas pulsaciones (debounce) antes de emitir. Por lo tanto,
// para toda ráfaga de cambios ocurridos dentro de la ventana de 300 ms, el hook
// SHALL producir a lo sumo una emisión y con el último valor de la ráfaga.

const DELAY = 300;

describe('Property 26: Debounce de búsqueda colapsa ráfagas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('una ráfaga dentro de la ventana emite a lo sumo una vez con el último valor', () => {
    fc.assert(
      fc.property(
        // Valor inicial de la ráfaga (el índice de la primera "tecla").
        fc.nat({ max: 1000 }),
        // Ráfaga: al menos un cambio. Cada elemento aporta un incremento del valor
        // tecleado (garantiza que cada pulsación cambia el valor y por tanto
        // reinicia el temporizador, como una pulsación real) y el avance de reloj
        // (< DELAY) transcurrido antes de la siguiente pulsación. Al ser cada hueco
        // menor que DELAY, ninguno alcanza a disparar la emisión intermedia.
        fc.array(
          fc.record({
            delta: fc.integer({ min: 1, max: 50 }),
            gap: fc.integer({ min: 0, max: DELAY - 1 }),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        (semilla, pasos) => {
          // Construir la secuencia de valores distintos: cada tecleo suma su delta,
          // de modo que dos pulsaciones consecutivas nunca coinciden y siempre
          // reinician el debounce.
          let acc = semilla;
          const valorInicial = `q${acc}`;
          const rafaga = pasos.map(({ delta, gap }) => {
            acc += delta;
            return { valor: `q${acc}`, gap };
          });

          const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, DELAY),
            { initialProps: { value: valorInicial } },
          );

          // Tras el montaje, el hook devuelve el valor inicial sin emisiones extra.
          expect(result.current).toBe(valorInicial);

          // Reproducir la ráfaga: cada cambio cancela el temporizador anterior y
          // arranca uno nuevo. Los gaps son < DELAY, así que ningún temporizador
          // expira durante la ráfaga; el valor estabilizado no cambia.
          for (const { valor, gap } of rafaga) {
            act(() => {
              rerender({ value: valor });
            });
            act(() => {
              vi.advanceTimersByTime(gap);
            });
            // Aún dentro de la ventana: no se ha emitido ningún valor nuevo.
            expect(result.current).toBe(valorInicial);
          }

          const ultimoValor = rafaga[rafaga.length - 1].valor;

          // Completar la ventana de silencio: recién ahora debe emitirse, y solo
          // el último valor de la ráfaga.
          act(() => {
            vi.advanceTimersByTime(DELAY);
          });
          expect(result.current).toBe(ultimoValor);

          // No hay temporizadores pendientes: la ráfaga colapsó en una sola emisión.
          expect(vi.getTimerCount()).toBe(0);

          // Dejar pasar más tiempo no produce nuevas emisiones.
          act(() => {
            vi.advanceTimersByTime(DELAY * 3);
          });
          expect(result.current).toBe(ultimoValor);
        },
      ),
      { numRuns: 150 },
    );
  });
});
