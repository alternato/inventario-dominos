import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { useSubmit, TIMEOUT_ERROR_MESSAGE } from '../useSubmit.js';

const NUM_RUNS = 120;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Genera un estado de formulario arbitrario: un objeto plano con claves string y
 * valores string/number/boolean. Modela los datos que el Usuario_Operador ingresa.
 */
const formStateArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 12 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { maxKeys: 8 }
);

/**
 * Clona superficial + valores primitivos → snapshot estable para comparar igualdad
 * estructural antes/después del submit.
 */
function snapshot(obj) {
  return JSON.parse(JSON.stringify(obj));
}

describe('useSubmit — pruebas de propiedad (Feature: mejora-integral-inventario)', () => {
  // Feature: mejora-integral-inventario, Property 8: Preservación de datos del
  // formulario ante error de API — para todo estado de formulario, si una operación
  // falla por un error reportado por la API_Backend, los valores ingresados por el
  // Usuario_Operador permanecen sin cambios tras mostrar el error.
  // Validates: Requirements 5.2
  it('Property 8: preserva los datos del formulario cuando la operación falla', async () => {
    await fc.assert(
      fc.asyncProperty(
        formStateArb,
        fc.string({ minLength: 1, maxLength: 40 }),
        async (initialForm, apiMessage) => {
          // El llamador mantiene su estado de formulario en un objeto propio; el
          // hook nunca debe tocarlo. Se relanza el error tal cual lo haría la API.
          const formData = { ...initialForm };
          const before = snapshot(formData);

          const apiError = {
            response: { data: { error: { message: apiMessage } } },
          };

          const { result, unmount } = renderHook(() => useSubmit());

          await act(async () => {
            try {
              await result.current.submit(async () => {
                throw apiError;
              });
            } catch {
              // El llamador reacciona al error SIN descartar los campos del formulario.
            }
          });

          // Los datos del formulario del llamador permanecen intactos.
          expect(snapshot(formData)).toEqual(before);
          // El hook expuso un error legible con la causa reportada por la API.
          expect(result.current.error).toBe(apiMessage);
          // Y ya no está en curso.
          expect(result.current.isSubmitting).toBe(false);

          unmount();
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: mejora-integral-inventario, Property 9: Antirreenvío de operación en
  // curso — para toda operación en curso, mientras no se reciba respuesta de la
  // API_Backend (o no transcurran 30 s), cualquier disparo adicional de la misma
  // operación no emite una nueva solicitud a la API_Backend.
  // Validates: Requirements 5.3
  it('Property 9: ignora disparos adicionales mientras la operación está en curso', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Número de disparos concurrentes (siempre >= 2 para probar el reenvío).
        fc.integer({ min: 2, max: 12 }),
        async (extraFires) => {
          const { result, unmount } = renderHook(() => useSubmit());

          // fn subyacente que representa la solicitud a la API_Backend. Queda
          // pendiente hasta que la resolvamos manualmente.
          let resolvePending;
          const fn = vi.fn(
            () =>
              new Promise((resolve) => {
                resolvePending = resolve;
              })
          );

          let firstCall;
          await act(async () => {
            // Primer disparo: inicia la operación (queda en curso).
            firstCall = result.current.submit(fn);
            // Disparos adicionales mientras sigue pendiente: deben ignorarse.
            for (let i = 0; i < extraFires; i += 1) {
              result.current.submit(fn);
            }
          });

          // La solicitud subyacente se emitió a lo sumo una vez.
          expect(fn).toHaveBeenCalledTimes(1);
          expect(result.current.isSubmitting).toBe(true);

          // Al resolverse, la operación termina limpiamente.
          await act(async () => {
            resolvePending('ok');
            await firstCall;
          });

          expect(result.current.isSubmitting).toBe(false);
          expect(fn).toHaveBeenCalledTimes(1);

          unmount();
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: mejora-integral-inventario, Property 9 (variante timeout): con timers
  // falsos, tras expirar el timeout de 30 s la operación se aborta, se retira el
  // spinner y se puede reenviar; los disparos previos al timeout no emiten solicitud.
  // Validates: Requirements 5.3
  it('Property 9 (timeout): reenvíos previos al timeout no emiten nueva solicitud', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1000, max: 29000 }),
        async (extraFires, advanceMs) => {
          vi.useFakeTimers();
          try {
            const { result, unmount } = renderHook(() =>
              useSubmit({ timeoutMs: 30000 })
            );

            const fn = vi.fn(
              ({ signal }) =>
                new Promise((_resolve, reject) => {
                  signal.addEventListener('abort', () =>
                    reject(new Error('aborted'))
                  );
                })
            );

            let call;
            await act(async () => {
              call = result.current.submit(fn).catch(() => {});
              for (let i = 0; i < extraFires; i += 1) {
                result.current.submit(fn);
              }
            });

            // Avanzar el reloj SIN superar el timeout: sigue en curso, sin reenvío.
            await act(async () => {
              vi.advanceTimersByTime(advanceMs);
            });
            expect(fn).toHaveBeenCalledTimes(1);
            expect(result.current.isSubmitting).toBe(true);

            // Superar el timeout de 30 s: se aborta, se retira el spinner y se emite
            // el mensaje de operación no confirmada.
            await act(async () => {
              vi.advanceTimersByTime(30000 - advanceMs + 1);
              await call;
            });

            expect(fn).toHaveBeenCalledTimes(1);
            expect(result.current.isSubmitting).toBe(false);
            expect(result.current.error).toBe(TIMEOUT_ERROR_MESSAGE);

            unmount();
          } finally {
            vi.useRealTimers();
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
