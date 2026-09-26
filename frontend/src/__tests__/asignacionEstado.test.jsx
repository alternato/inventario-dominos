// Feature: mejora-integral-inventario, Property 11: Estado de Asignacion dentro del conjunto válido
import { describe, test, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import {
  EstadoAsignacionBadge,
  CicloVidaAsignacion,
} from '../components/activos/HistorialAsignaciones';

/**
 * Property 11 — Estado de Asignacion dentro del conjunto válido (Valida Req. 6.1)
 *
 * El estado del ciclo de vida de una Asignacion siempre pertenece al conjunto
 * válido {activa, pendiente_firma, cerrada, cancelada}. Al renderizar el estado
 * en la UI, la etiqueta mostrada debe ser exactamente una del conjunto de
 * etiquetas válidas correspondientes.
 */
describe('Property 11: Estado de Asignacion dentro del conjunto válido', () => {
  // Conjunto válido de estados y su etiqueta renderizada esperada.
  const ETIQUETAS_VALIDAS = {
    activa: 'Activa',
    pendiente_firma: 'Pendiente de firma',
    cerrada: 'Cerrada',
    cancelada: 'Cancelada',
  };

  const ESTADOS_VALIDOS = Object.keys(ETIQUETAS_VALIDAS);
  const LABELS_VALIDOS = Object.values(ETIQUETAS_VALIDAS);

  const estadoArb = fc.constantFrom(...ESTADOS_VALIDOS);

  test('EstadoAsignacionBadge renderiza exactamente una etiqueta del conjunto válido', () => {
    fc.assert(
      fc.property(estadoArb, (estado) => {
        cleanup();
        render(<EstadoAsignacionBadge estado={estado} />);

        // La etiqueta esperada para este estado debe estar presente.
        const esperada = ETIQUETAS_VALIDAS[estado];
        expect(screen.getByText(esperada)).toBeInTheDocument();

        // La etiqueta renderizada es exactamente una del conjunto válido.
        const presentes = LABELS_VALIDOS.filter(
          (label) => screen.queryByText(label) !== null,
        );
        expect(presentes).toEqual([esperada]);
      }),
      { numRuns: 100 },
    );
  });

  test('CicloVidaAsignacion renderiza exactamente una etiqueta del conjunto válido', () => {
    fc.assert(
      fc.property(estadoArb, (estado) => {
        cleanup();
        render(<CicloVidaAsignacion asignacion={{ estado }} />);

        const esperada = ETIQUETAS_VALIDAS[estado];
        expect(screen.getByText(esperada)).toBeInTheDocument();

        const presentes = LABELS_VALIDOS.filter(
          (label) => screen.queryByText(label) !== null,
        );
        expect(presentes).toEqual([esperada]);
      }),
      { numRuns: 100 },
    );
  });
});
