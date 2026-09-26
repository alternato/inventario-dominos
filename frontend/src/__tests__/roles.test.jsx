// Feature: mejora-integral-inventario, Property 7: Ningún control de escritura habilitado para viewer
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, within, act } from '@testing-library/react';
import fc from 'fast-check';

// --- Mocks de infraestructura de los componentes en prueba ---------------------
// DetallePanelActivo importa el store de activos y la API; para renderizar con
// rol viewer no necesitamos comportamiento real: basta con neutralizar efectos.
vi.mock('../store/activosStore', () => {
  // El estado (y en particular `cargarAsignacionesActivo`) debe tener identidad
  // ESTABLE entre renders: DetallePanelActivo depende de esa función en su
  // useEffect ([activo, cargarAsignacionesActivo]). Si el mock devolviera una
  // nueva vi.fn() en cada llamada al selector, la dependencia cambiaría en cada
  // commit y el efecto se re-dispararía en bucle, colgando act()/asyncProperty.
  const state = {
    cargarAsignacionesActivo: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  };
  return {
    useActivosStore: (selector) =>
      typeof selector === 'function' ? selector(state) : state,
  };
});

vi.mock('../api', () => ({
  activosAPI: {
    // Nunca resuelve datos que agreguen controles; devuelve la ficha vacía.
    obtener: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

import { ActivosHeader } from '../components/activos/ActivosHeader';
import { ActivosTabla } from '../components/activos/ActivosTabla';
import { DetallePanelActivo } from '../components/activos/DetallePanelActivo';

// -------------------------------------------------------------------------------
// Textos/etiquetas que identifican un CONTROL DE ESCRITURA (crear/editar/
// asignar/devolver/eliminar/importar). Property 7 exige que ninguno exista
// habilitado bajo rol viewer.
const WRITE_CONTROL_PATTERNS = [
  /nuevo/i,
  /crear/i,
  /importar/i,
  /editar/i,
  /^editar ficha$/i,
  /asignar/i,
  /desasignar/i,
  /devolver/i,
  /devoluci/i,
  /eliminar/i,
];

// Un botón se considera "control de escritura habilitado" si su nombre
// accesible o su atributo title coincide con un patrón de escritura y no
// está deshabilitado.
function findEnabledWriteControls(container) {
  const offenders = [];
  const buttons = container.querySelectorAll('button');
  buttons.forEach((btn) => {
    const label = (
      btn.getAttribute('aria-label') ||
      btn.getAttribute('title') ||
      btn.textContent ||
      ''
    ).trim();
    if (!label) return;
    const isWrite = WRITE_CONTROL_PATTERNS.some((re) => re.test(label));
    if (!isWrite) return;
    // "Cerrar ficha" no es un control de escritura; ya se excluye porque no
    // coincide con ningún patrón. Verificamos que esté deshabilitado.
    const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
    if (!disabled) offenders.push(label);
  });
  return offenders;
}

// -------------------------------------------------------------------------------
// Generadores (arbitraries) que exploran el espacio de props relevante.
const estadoArb = fc.constantFrom('Asignado', 'Disponible', 'Mantenimiento', 'Descartado');
const tipoArb = fc.constantFrom('Notebook', 'Desktop', 'Smartphone', 'Tablet', 'SIM Card', 'Monitor');

const activoArb = fc.record({
  serie: fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim().length > 0),
  marca: fc.string({ maxLength: 10 }),
  modelo: fc.string({ maxLength: 10 }),
  estado: estadoArb,
  tipo_dispositivo: tipoArb,
  ubicacion: fc.option(fc.string({ maxLength: 10 }), { nil: undefined }),
  rut_responsable: fc.option(fc.string({ maxLength: 12 }), { nil: null }),
  colaborador: fc.option(
    fc.record({ nombre: fc.string({ maxLength: 10 }) }),
    { nil: null }
  ),
});

// Series únicas para evitar keys duplicadas de React en la tabla.
const activosArb = fc
  .array(activoArb, { minLength: 0, maxLength: 8 })
  .map((arr) => {
    const seen = new Set();
    return arr.filter((a) => {
      if (seen.has(a.serie)) return false;
      seen.add(a.serie);
      return true;
    });
  });

const noop = () => {};

beforeEach(() => {
  cleanup();
});

describe('Property 7: Ningún control de escritura habilitado para viewer', () => {
  // isAdmin={false} equivale al rol viewer (useAuthStore().isAdmin() → false).
  const ISADMIN_VIEWER = false;

  test('ActivosHeader no expone controles de escritura habilitados para viewer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 0, max: 9999 }),
        fc.option(estadoArb, { nil: '' }),
        (total, filtrados, filtroEstado) => {
          const { container } = render(
            <ActivosHeader
              total={total}
              filtrados={filtrados}
              filtroEstado={filtroEstado}
              isAdmin={ISADMIN_VIEWER}
              onNuevo={noop}
              onImportar={noop}
            />
          );
          const offenders = findEnabledWriteControls(container);
          cleanup();
          expect(offenders).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('ActivosTabla no expone controles de escritura habilitados para viewer', () => {
    fc.assert(
      fc.property(
        activosArb,
        fc.option(fc.string({ maxLength: 8 }), { nil: '' }),
        fc.option(estadoArb, { nil: '' }),
        (activos, busqueda, filtroEstado) => {
          const { container } = render(
            <ActivosTabla
              activos={activos}
              duplicadosSeries={new Set()}
              panelActivo={null}
              onSelectRow={noop}
              isAdmin={ISADMIN_VIEWER}
              busqueda={busqueda}
              filtroEstado={filtroEstado}
              onLimpiarFiltros={noop}
              onEditar={noop}
              onDevolucion={noop}
              onEliminar={noop}
            />
          );
          const offenders = findEnabledWriteControls(container);
          // Además: la columna "Acciones" no debe existir para viewer.
          const accionesHeader = within(container).queryByText(/acciones/i);
          cleanup();
          expect(offenders).toEqual([]);
          expect(accionesHeader).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('DetallePanelActivo no expone controles de escritura habilitados para viewer', async () => {
    // El footer con acciones de escritura (Devolver/Asignar/Editar) se decide de
    // forma síncrona por `isAdmin`; con viewer no se renderiza. Envolvemos cada
    // render en act() para drenar los efectos async del panel (fetch de ficha +
    // carga de asignaciones, ambos mockeados) y desmontamos explícitamente en
    // cada iteración para evitar fugas de estado entre corridas de la propiedad.
    await fc.assert(
      fc.asyncProperty(activoArb, async (activo) => {
        let container;
        let unmount;
        await act(async () => {
          ({ container, unmount } = render(
            <DetallePanelActivo
              activo={activo}
              isAdmin={ISADMIN_VIEWER}
              onEditar={noop}
              onDevolucion={noop}
              onAsignar={noop}
              onCerrar={noop}
              isDuplicate={false}
            />
          ));
          // Drenar promesas pendientes de los efectos (fetch + asignaciones).
          await Promise.resolve();
          await Promise.resolve();
        });
        const offenders = findEnabledWriteControls(container);
        // Desmontar dentro de act() para procesar la limpieza de efectos.
        await act(async () => {
          unmount();
        });
        expect(offenders).toEqual([]);
      }),
      { numRuns: 30 }
    );
  }, 30000);
});
