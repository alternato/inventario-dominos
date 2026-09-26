// Feature: mejora-integral-inventario, Property 34: Etiqueta accesible en cada control de formulario
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, act, fireEvent, within } from '@testing-library/react';
import fc from 'fast-check';

// --- Mocks de infraestructura --------------------------------------------------
// Los modales de formulario consumen el store de activos (sin selector, por
// destructuring) y, en el caso de ModalAsignacion, el store de auth. Para la
// Property 34 solo importa que los controles se rendericen con una etiqueta
// accesible; el comportamiento real del store es irrelevante, así que
// proveemos stubs mínimos que no añaden ni quitan controles.

// Colaboradores de ejemplo: alimentan los <select>/listas de los modales.
const COLABS_STUB = [
  { rut: '11111111-1', nombre: 'Ana Pérez', area: 'TI', correo: 'ana@empresa.cl' },
  { rut: '22222222-2', nombre: 'Beto Soto', area: 'Ventas', correo: '' },
];

const AREAS_STUB = [
  { id: 1, nombre: 'TI' },
  { id: 2, nombre: 'Ventas' },
];

// Estado del store de activos. Se expone completo porque los modales lo
// consumen por destructuring (useActivosStore()), no vía selector.
const activosState = {
  colaboradores: COLABS_STUB,
  areas: AREAS_STUB,
  cargarColaboradores: vi.fn().mockResolvedValue({ ok: true, data: COLABS_STUB }),
  cargarAreas: vi.fn().mockResolvedValue({ ok: true, data: AREAS_STUB }),
  crearActivo: vi.fn().mockResolvedValue(true),
  actualizarActivo: vi.fn().mockResolvedValue(true),
  crearColaborador: vi.fn().mockResolvedValue({ ok: true }),
  actualizarColaborador: vi.fn().mockResolvedValue({ ok: true }),
  crearArea: vi.fn().mockResolvedValue({ ok: true }),
  crearAsignacion: vi.fn().mockResolvedValue({ ok: true }),
  cerrarAsignacion: vi.fn().mockResolvedValue({ ok: true }),
  // Devuelve una asignación activa para que ModalDevolucion permita avanzar de paso.
  cargarAsignacionesActivo: vi
    .fn()
    .mockResolvedValue({ data: [{ id: 99, estado: 'activa' }] }),
};

vi.mock('../store/activosStore', () => ({
  useActivosStore: (selector) =>
    typeof selector === 'function' ? selector(activosState) : activosState,
}));

vi.mock('../store/authStore', () => {
  const authState = { usuario: { nombre: 'Operador TI', rol: 'admin' } };
  return {
    useAuthStore: (selector) =>
      typeof selector === 'function' ? selector(authState) : authState,
  };
});

import { ModalFormulario } from '../components/ModalFormulario';
import { ModalColaborador } from '../components/ModalColaborador';
import { ModalAsignacion } from '../components/ModalAsignacion';
import { ModalDevolucion } from '../components/ModalDevolucion';

// -------------------------------------------------------------------------------
// Núcleo de la Property 34: para TODO control de formulario renderizado, debe
// existir una etiqueta accesible asociada, ya sea mediante:
//   - un <label> asociado (htmlFor/id o envoltura) -> element.labels no vacío
//   - aria-label con texto no vacío
//   - aria-labelledby que apunta a un elemento con texto
// Se excluyen los controles ocultos (type="hidden"), que no son operables.

/** Devuelve true si `el` (input/select/textarea) tiene nombre accesible. */
function tieneEtiquetaAccesible(el) {
  // 1) <label> asociado. jsdom expone element.labels para controles etiquetables.
  if (el.labels && el.labels.length > 0) {
    const conTexto = Array.from(el.labels).some(
      (l) => (l.textContent || '').trim().length > 0,
    );
    if (conTexto) return true;
  }

  // 2) aria-label directo.
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim().length > 0) return true;

  // 3) aria-labelledby -> algún id referenciado con texto.
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const conTexto = labelledby
      .split(/\s+/)
      .filter(Boolean)
      .some((id) => {
        const ref = el.ownerDocument.getElementById(id);
        return ref && (ref.textContent || '').trim().length > 0;
      });
    if (conTexto) return true;
  }

  // 4) title como último recurso reconocido por el cálculo de nombre accesible.
  const title = el.getAttribute('title');
  if (title && title.trim().length > 0) return true;

  return false;
}

/**
 * Recorre todos los controles de formulario del contenedor y devuelve la lista
 * de controles SIN etiqueta accesible (los "infractores"). Los controles ocultos
 * se ignoran por no ser operables.
 */
function controlesSinEtiqueta(container) {
  const controles = container.querySelectorAll(
    'input:not([type="hidden"]), select, textarea',
  );
  const infractores = [];
  controles.forEach((el) => {
    if (!tieneEtiquetaAccesible(el)) {
      infractores.push(
        `${el.tagName.toLowerCase()}` +
          (el.getAttribute('name') ? `[name=${el.getAttribute('name')}]` : '') +
          (el.id ? `#${el.id}` : '') +
          (el.type ? `(type=${el.type})` : ''),
      );
    }
  });
  return infractores;
}

// -------------------------------------------------------------------------------
// Generadores (arbitraries).
const textoCorto = fc.string({ maxLength: 12 });

const tipoDispositivoArb = fc.constantFrom(
  'Laptop',
  'Desktop',
  'Smartphone',
  'Tablet',
  'Impresora',
  'SIM Card',
  'Servidor',
  'Monitor',
  'Otro',
);
const estadoArb = fc.constantFrom('Asignado', 'Disponible', 'Mantenimiento', 'Descartado');

// `activo` arbitrario. Se varía tipo_dispositivo para ejercitar los campos
// condicionales (IMEI/SIM en Smartphone y SIM Card). `null` representa "crear".
const activoArb = fc.option(
  fc.record({
    serie: textoCorto.filter((s) => s.trim().length > 0),
    marca: textoCorto,
    modelo: textoCorto,
    tipo_dispositivo: tipoDispositivoArb,
    estado: estadoArb,
    rut_responsable: fc.option(fc.constantFrom('11111111-1', '22222222-2'), { nil: null }),
    ubicacion: fc.option(textoCorto, { nil: null }),
    colaborador: fc.option(
      fc.record({
        nombre: textoCorto,
        correo: fc.option(fc.emailAddress(), { nil: '' }),
      }),
      { nil: null },
    ),
  }),
  { nil: null },
);

// `activo` no nulo para los modales que requieren un equipo (asignación/devolución).
const activoNoNuloArb = fc.record({
  serie: textoCorto.filter((s) => s.trim().length > 0),
  marca: textoCorto,
  modelo: textoCorto,
  tipo_dispositivo: tipoDispositivoArb,
  estado: estadoArb,
  rut_responsable: fc.constantFrom('11111111-1', '22222222-2'),
  colaborador: fc.option(
    fc.record({
      nombre: textoCorto,
      correo: fc.option(fc.emailAddress(), { nil: '' }),
    }),
    { nil: null },
  ),
});

// `colaborador` arbitrario para ModalColaborador. `null` representa "crear".
const colaboradorArb = fc.option(
  fc.record({
    rut: fc.constantFrom('11111111-1', '22222222-2', '33333333-3'),
    nombre: textoCorto,
    correo: fc.option(fc.emailAddress(), { nil: '' }),
    area: fc.constantFrom('TI', 'Ventas', ''),
    cargo: fc.option(textoCorto, { nil: undefined }),
    telefono: fc.option(textoCorto, { nil: undefined }),
    activo: fc.boolean(),
    total_activos: fc.integer({ min: 0, max: 5 }),
  }),
  { nil: null },
);

const noop = () => {};

beforeEach(() => {
  cleanup();
});

describe('Property 34: Etiqueta accesible en cada control de formulario', () => {
  test('ModalFormulario: todo control tiene etiqueta accesible', () => {
    fc.assert(
      fc.property(activoArb, (activo) => {
        cleanup();
        const { container } = render(
          <ModalFormulario isOpen={true} onClose={noop} activo={activo} />,
        );
        const infractores = controlesSinEtiqueta(container);
        expect(infractores).toEqual([]);
      }),
      { numRuns: 120 },
    );
  });

  test('ModalColaborador: todo control tiene etiqueta accesible', () => {
    fc.assert(
      fc.property(colaboradorArb, fc.boolean(), (colaborador, mostrarNuevaArea) => {
        cleanup();
        const { container } = render(
          <ModalColaborador
            isOpen={true}
            onClose={noop}
            colaborador={colaborador}
            onSuccess={noop}
          />,
        );
        // Ejercitar la ruta condicional "añadir nueva área" (input de texto
        // alternativo al <select>), que también debe estar etiquetado.
        if (mostrarNuevaArea) {
          const areaSelect = container.querySelector('#colab-area');
          if (areaSelect) {
            fireEvent.change(areaSelect, { target: { value: 'ADD_NEW' } });
          }
        }
        const infractores = controlesSinEtiqueta(container);
        expect(infractores).toEqual([]);
      }),
      { numRuns: 120 },
    );
  });

  test('ModalAsignacion: todo control tiene etiqueta accesible (ambos pasos)', () => {
    fc.assert(
      fc.property(activoNoNuloArb, fc.boolean(), (activo, avanzar) => {
        cleanup();
        const { container } = render(
          <ModalAsignacion
            isOpen={true}
            onClose={noop}
            activo={activo}
            onSuccess={noop}
          />,
        );

        // Paso 0: buscador de colaborador.
        expect(controlesSinEtiqueta(container)).toEqual([]);

        if (avanzar) {
          // Seleccionar un colaborador y avanzar al paso 1 (entrega + notas).
          const buscador = container.querySelector('#asig-busqueda');
          if (buscador) {
            fireEvent.change(buscador, { target: { value: 'Ana' } });
            // Clic en el primer resultado de la lista.
            const opcion = within(container).queryByText('Ana Pérez');
            if (opcion) {
              fireEvent.click(opcion.closest('button'));
              // Botón "Siguiente".
              const siguiente = within(container).queryByRole('button', {
                name: /siguiente/i,
              });
              if (siguiente && !siguiente.disabled) {
                fireEvent.click(siguiente);
              }
            }
          }
          // Paso 1: los controles de entrega/notas también deben estar etiquetados.
          expect(controlesSinEtiqueta(container)).toEqual([]);
        }
      }),
      { numRuns: 120 },
    );
  });

  test('ModalDevolucion: todo control tiene etiqueta accesible (ambos pasos)', async () => {
    await fc.assert(
      fc.asyncProperty(activoNoNuloArb, fc.boolean(), async (activo, avanzar) => {
        cleanup();
        let container;
        await act(async () => {
          ({ container } = render(
            <ModalDevolucion
              isOpen={true}
              onClose={noop}
              activo={activo}
              onSuccess={noop}
            />,
          ));
          // Drenar el efecto async que carga la asignación activa.
          await Promise.resolve();
          await Promise.resolve();
        });

        // Paso 0: motivo + estado físico.
        expect(controlesSinEtiqueta(container)).toEqual([]);

        if (avanzar) {
          await act(async () => {
            const siguiente = within(container).queryByRole('button', {
              name: /siguiente/i,
            });
            if (siguiente && !siguiente.disabled) {
              fireEvent.click(siguiente);
            }
            await Promise.resolve();
          });
          // Paso 1: confirmación por correo (input de correo alterno cuando
          // el colaborador no tiene correo corporativo). Debe estar etiquetado.
          expect(controlesSinEtiqueta(container)).toEqual([]);
        }
      }),
      { numRuns: 120 },
    );
  });
});
