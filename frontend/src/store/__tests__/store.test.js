import { describe, test, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Espiamos el cliente API del store. El store importa desde '../api'; desde este
// archivo de prueba el módulo se resuelve como '../../api'. Mockeamos únicamente
// los métodos `listar` de cada dominio (los que dispara una lectura del store)
// para poder contar solicitudes reales.
vi.mock('../../api', () => {
  const listarResponse = () => ({ data: { data: [], pagination: null } });
  return {
    activosAPI: {
      listar: vi.fn(async () => listarResponse()),
      obtener: vi.fn(async () => ({ data: { data: {} } })),
      crear: vi.fn(async () => ({ data: { data: {} } })),
      actualizar: vi.fn(async () => ({ data: { data: {} } })),
      eliminar: vi.fn(async () => ({ data: {} })),
    },
    colaboradoresAPI: {
      listar: vi.fn(async () => listarResponse()),
      crear: vi.fn(async () => ({ data: { data: {} } })),
      actualizar: vi.fn(async () => ({ data: { data: {} } })),
      eliminar: vi.fn(async () => ({ data: {} })),
    },
    areasAPI: {
      listar: vi.fn(async () => listarResponse()),
      crear: vi.fn(async () => ({ data: { data: {} } })),
      actualizar: vi.fn(async () => ({ data: { data: {} } })),
      eliminar: vi.fn(async () => ({ data: {} })),
    },
    asignacionesAPI: {
      listar: vi.fn(async () => listarResponse()),
      crear: vi.fn(async () => ({ data: { data: {} } })),
      cerrar: vi.fn(async () => ({ data: { data: {} } })),
      porActivo: vi.fn(async () => ({ data: { data: [] } })),
      porColab: vi.fn(async () => ({ data: { data: [] } })),
    },
  };
});

import { useActivosStore } from '../activosStore';
import {
  activosAPI,
  colaboradoresAPI,
  asignacionesAPI,
} from '../../api';

// Estado inicial "limpio" del store para restablecer entre corridas de propiedad.
// Refleja los defaults del store (banderas `dirty` en true, listas vacías).
const estadoBase = () => ({
  activos: [],
  colaboradores: [],
  areas: [],
  asignaciones: [],
  loading: false,
  error: null,
  activosPagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
  colaboradoresPagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
  asignacionesPagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
  activosDirty: true,
  colaboradoresDirty: true,
  asignacionesDirty: true,
});

const resetStore = () => {
  // Reset parcial: solo datos/paginación/banderas. NO usamos el flag de reemplazo
  // total de Zustand, porque las acciones del store viven en el mismo objeto de
  // estado y un reemplazo total las eliminaría.
  useActivosStore.setState(estadoBase());
};

// Mapa por dominio: bandera dirty, cargador, spy del `listar`, y una escritura
// representativa que debe invalidar ese dominio.
const dominios = {
  activos: {
    dirtyKey: 'activosDirty',
    cargar: () => useActivosStore.getState().cargarActivos(),
    spy: () => activosAPI.listar,
    escribir: () => useActivosStore.getState().crearActivo({ serie: 'S1' }),
  },
  colaboradores: {
    dirtyKey: 'colaboradoresDirty',
    cargar: () => useActivosStore.getState().cargarColaboradores(),
    spy: () => colaboradoresAPI.listar,
    escribir: () =>
      useActivosStore.getState().crearColaborador({ rut: '11111111-1' }),
  },
  asignaciones: {
    dirtyKey: 'asignacionesDirty',
    cargar: () => useActivosStore.getState().cargarAsignaciones(),
    spy: () => asignacionesAPI.listar,
    // crearAsignacion también toca activos (obtener), pero invalida asignaciones.
    escribir: () =>
      useActivosStore.getState().crearAsignacion({ serie_activo: 'S1' }),
  },
};

const dominioArb = fc.constantFrom('activos', 'colaboradores', 'asignaciones');

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe('Property 24: Reutilización de datos no invalidados del store', () => {
  // Feature: mejora-integral-inventario, Property 24: Reutilización de datos no
  // invalidados del store — tras una carga exitosa que limpia la marca `dirty`,
  // una segunda lectura sin escritura intermedia NO emite ninguna solicitud nueva.
  test('una segunda lectura sin invalidación no dispara solicitudes al API', async () => {
    await fc.assert(
      fc.asyncProperty(dominioArb, async (nombre) => {
        resetStore();
        const dom = dominios[nombre];
        const listar = dom.spy();
        listar.mockClear();

        // Primera carga: el dominio inicia `dirty`, por lo que emite exactamente 1 solicitud.
        await dom.cargar();
        expect(listar).toHaveBeenCalledTimes(1);
        expect(useActivosStore.getState()[dom.dirtyKey]).toBe(false);

        // Segunda carga sin invalidar: debe reutilizar la caché ⇒ cero solicitudes nuevas.
        const res = await dom.cargar();
        expect(res).toEqual({ ok: true, cached: true });
        expect(listar).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 25: Recarga tras invalidación por escritura', () => {
  // Feature: mejora-integral-inventario, Property 25: Recarga tras invalidación
  // por escritura — tras cargar (marca limpia) y una escritura que invalida el
  // dominio, la siguiente lectura emite EXACTAMENTE una solicitud y limpia la marca.
  test('una escritura invalida el dominio y la siguiente lectura recarga exactamente una vez', async () => {
    await fc.assert(
      fc.asyncProperty(dominioArb, async (nombre) => {
        resetStore();
        const dom = dominios[nombre];
        const listar = dom.spy();

        // Carga inicial deja el dominio limpio (dirty=false).
        await dom.cargar();
        expect(useActivosStore.getState()[dom.dirtyKey]).toBe(false);

        // Una escritura marca el dominio como `dirty` de nuevo.
        await dom.escribir();
        expect(useActivosStore.getState()[dom.dirtyKey]).toBe(true);

        // A partir de aquí, contamos solo las solicitudes de la recarga.
        listar.mockClear();

        const res = await dom.cargar();
        // La recarga fue real (no cacheada) y emitió exactamente una solicitud.
        expect(res).toEqual({ ok: true, cached: false });
        expect(listar).toHaveBeenCalledTimes(1);
        // Y la marca queda limpia tras la recarga.
        expect(useActivosStore.getState()[dom.dirtyKey]).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
