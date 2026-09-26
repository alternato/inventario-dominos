// Feature: mejora-integral-inventario, Property 10: Confirmación previa obligatoria para eliminación
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { ConfirmDialog } from '../ConfirmDialog';

afterEach(() => {
  cleanup();
});

/**
 * Property 10 — Confirmación previa obligatoria para eliminación (Valida: Requisitos 5.5).
 *
 * El diálogo de borrado solo debe invocar `onConfirm` (que en producción dispara el
 * endpoint de eliminación) cuando el operador pulsa explícitamente el botón de confirmar.
 * Ninguna otra interacción — montar, cancelar, Escape, clic en el backdrop, botón de cerrar —
 * debe llegar a invocar `onConfirm`.
 */

// Generador de identificadores/entidades arbitrarios (incluye vacíos y unicode).
const textoArb = fc.string({ maxLength: 40 });

// Interacciones que NO deben confirmar nunca.
const NON_CONFIRM_ACTIONS = ['cancel', 'escape', 'backdrop', 'close'];
const nonConfirmActionArb = fc.constantFrom(...NON_CONFIRM_ACTIONS);

/** Ejecuta una interacción de no-confirmación sobre un diálogo ya renderizado. */
function performNonConfirm(action) {
  switch (action) {
    case 'cancel': {
      const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
      fireEvent.click(cancelBtn);
      break;
    }
    case 'escape': {
      fireEvent.keyDown(document, { key: 'Escape' });
      break;
    }
    case 'backdrop': {
      // El backdrop es el contenedor exterior del diálogo.
      const dialog = screen.getByRole('dialog');
      const backdrop = dialog.parentElement;
      fireEvent.click(backdrop);
      break;
    }
    case 'close': {
      const closeBtn = screen.getByRole('button', { name: /cerrar/i });
      fireEvent.click(closeBtn);
      break;
    }
    default:
      break;
  }
}

describe('ConfirmDialog — Property 10: confirmación previa obligatoria', () => {
  test('ninguna secuencia de interacciones de no-confirmación invoca onConfirm', () => {
    fc.assert(
      fc.property(
        textoArb,
        textoArb,
        fc.array(nonConfirmActionArb, { minLength: 0, maxLength: 6 }),
        (entidad, identificador, acciones) => {
          const onConfirm = vi.fn();
          const onCancel = vi.fn();

          render(
            <ConfirmDialog
              isOpen
              entidad={entidad}
              identificador={identificador}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          );

          // Montar el diálogo no debe disparar la acción destructiva.
          expect(onConfirm).not.toHaveBeenCalled();

          for (const accion of acciones) {
            // Tras cancelar/cerrar el diálogo puede desmontarse en producción; aquí
            // isOpen se mantiene, por lo que los controles siguen presentes. Solo
            // ejecutamos la acción si el diálogo sigue en el DOM.
            if (screen.queryByRole('dialog')) {
              performNonConfirm(accion);
            }
          }

          // Bajo ninguna combinación de acciones de no-confirmación se llama onConfirm.
          expect(onConfirm).not.toHaveBeenCalled();

          cleanup();
        }
      ),
      { numRuns: 120 }
    );
  });

  test('exactamente un clic de confirmación invoca onConfirm una sola vez', () => {
    fc.assert(
      fc.property(textoArb, textoArb, (entidad, identificador) => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        render(
          <ConfirmDialog
            isOpen
            entidad={entidad}
            identificador={identificador}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        );

        expect(onConfirm).not.toHaveBeenCalled();

        const confirmBtn = screen.getByRole('button', { name: /eliminar/i });
        fireEvent.click(confirmBtn);

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();

        cleanup();
      }),
      { numRuns: 120 }
    );
  });

  test('clics de no-confirmación previos y un clic de confirmación posterior: onConfirm una vez', () => {
    fc.assert(
      fc.property(
        textoArb,
        textoArb,
        fc.array(nonConfirmActionArb, { minLength: 0, maxLength: 4 }),
        (entidad, identificador, accionesPrevias) => {
          const onConfirm = vi.fn();
          const onCancel = vi.fn();

          render(
            <ConfirmDialog
              isOpen
              entidad={entidad}
              identificador={identificador}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          );

          for (const accion of accionesPrevias) {
            if (screen.queryByRole('dialog')) {
              performNonConfirm(accion);
            }
          }

          // Ninguna acción previa debió confirmar.
          expect(onConfirm).not.toHaveBeenCalled();

          // El diálogo permanece abierto (isOpen fijo), así que el botón sigue disponible.
          const confirmBtn = screen.getByRole('button', { name: /eliminar/i });
          fireEvent.click(confirmBtn);

          expect(onConfirm).toHaveBeenCalledTimes(1);

          cleanup();
        }
      ),
      { numRuns: 120 }
    );
  });
});
