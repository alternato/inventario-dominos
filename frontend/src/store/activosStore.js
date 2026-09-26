import { create } from 'zustand';
import { activosAPI, colaboradoresAPI, areasAPI, asignacionesAPI } from '../api';

// Meta de paginación por defecto (coherente con backend: default 50, techo 200).
const emptyPagination = { page: 1, pageSize: 50, total: 0, totalPages: 0 };

// Los listados del backend responden con la forma { data, pagination } (Req. 9).
// Este helper tolera tanto la nueva forma paginada como respuestas planas legadas.
const unwrapList = (responseData) => {
  if (responseData && Array.isArray(responseData.data)) {
    return { data: responseData.data, pagination: responseData.pagination || null };
  }
  if (Array.isArray(responseData)) {
    return { data: responseData, pagination: null };
  }
  return { data: [], pagination: null };
};

export const useActivosStore = create((set, get) => ({
  activos: [],
  colaboradores: [],
  areas: [],
  asignaciones: [],
  loading: false,
  error: null,

  // ─── PAGINACIÓN POR DOMINIO ─────────────────────────────
  activosPagination: { ...emptyPagination },
  colaboradoresPagination: { ...emptyPagination },
  asignacionesPagination: { ...emptyPagination },

  // ─── BANDERAS DE INVALIDACIÓN (Req. 10.1, 10.2) ─────────
  // Inician en `true` porque aún no se ha cargado nada: la primera lectura
  // debe emitir una solicitud. Tras cargar se limpian; una escritura las
  // vuelve a marcar `true` para forzar recarga en la próxima lectura.
  activosDirty: true,
  colaboradoresDirty: true,
  asignacionesDirty: true,

  // Invalidadores explícitos por dominio (reutilizables por escrituras).
  invalidarActivos: () => set({ activosDirty: true }),
  invalidarColaboradores: () => set({ colaboradoresDirty: true }),
  invalidarAsignaciones: () => set({ asignacionesDirty: true }),

  // ─── ACTIVOS ────────────────────────────────────────────
  // Reutiliza los datos cacheados si el dominio no está `dirty` (Req. 10.1).
  // `force` u opciones de paginación/filtro fuerzan una recarga.
  cargarActivos: async (opts = {}) => {
    const { force = false, params } = opts;
    if (!force && !params && !get().activosDirty) {
      return { ok: true, cached: true };
    }
    set({ loading: true, error: null });
    try {
      const response = await activosAPI.listar(params);
      const { data, pagination } = unwrapList(response.data);
      set({
        activos: data,
        activosPagination: pagination || { ...emptyPagination },
        activosDirty: false,
        loading: false,
      });
      return { ok: true, cached: false };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { ok: false, error: error.message };
    }
  },

  crearActivo: async (data) => {
    try {
      const response = await activosAPI.crear(data);
      const nuevo = response.data?.data || response.data;
      set((state) => ({ activos: [nuevo, ...state.activos], activosDirty: true }));
      return { ok: true };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  actualizarActivo: async (serie, data) => {
    try {
      const response = await activosAPI.actualizar(serie, data);
      const actualizado = response.data?.data || response.data;
      set((state) => ({
        activos: state.activos.map((a) => a.serie === serie ? { ...a, ...actualizado } : a),
        activosDirty: true,
      }));
      return { ok: true };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  eliminarActivo: async (serie) => {
    try {
      await activosAPI.eliminar(serie);
      set((state) => ({
        activos: state.activos.filter((a) => a.serie !== serie),
        activosDirty: true,
      }));
      return { ok: true };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  // ─── COLABORADORES ──────────────────────────────────────
  cargarColaboradores: async (opts = {}) => {
    const { force = false, params } = opts;
    if (!force && !params && !get().colaboradoresDirty) {
      return { ok: true, cached: true };
    }
    set({ loading: true, error: null });
    try {
      const response = await colaboradoresAPI.listar(params);
      const { data, pagination } = unwrapList(response.data);
      set({
        colaboradores: data,
        colaboradoresPagination: pagination || { ...emptyPagination },
        colaboradoresDirty: false,
        loading: false,
      });
      return { ok: true, cached: false };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { ok: false, error: error.message };
    }
  },

  crearColaborador: async (data) => {
    try {
      const response = await colaboradoresAPI.crear(data);
      const nuevo = response.data?.data || response.data;
      set((state) => ({ colaboradores: [nuevo, ...state.colaboradores], colaboradoresDirty: true }));
      return { ok: true };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  actualizarColaborador: async (rut, data) => {
    try {
      const response = await colaboradoresAPI.actualizar(rut, data);
      const actualizado = response.data?.data || response.data;
      set((state) => ({
        colaboradores: state.colaboradores.map((c) =>
          c.rut === rut ? { ...c, ...actualizado } : c
        ),
        colaboradoresDirty: true,
      }));
      return { ok: true };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  eliminarColaborador: async (rut) => {
    try {
      await colaboradoresAPI.eliminar(rut);
      set((state) => ({
        colaboradores: state.colaboradores.filter((c) => c.rut !== rut),
        colaboradoresDirty: true,
      }));
      return { ok: true };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  // ─── ÁREAS ──────────────────────────────────────────────
  cargarAreas: async () => {
    try {
      const response = await areasAPI.listar();
      const { data } = unwrapList(response.data);
      set({ areas: data });
    } catch (error) {
      console.error('Error al cargar áreas:', error);
    }
  },

  crearArea: async (nombre) => {
    try {
      const response = await areasAPI.crear(nombre);
      const nueva = response.data?.data || response.data;
      set((state) => ({ areas: [...state.areas, nueva] }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.response?.data?.error || error.message };
    }
  },

  actualizarArea: async (id, nombre) => {
    try {
      const response = await areasAPI.actualizar(id, nombre);
      const actualizada = response.data?.data || response.data;
      set((state) => ({
        areas: state.areas.map((a) => (a.id === id ? actualizada : a)),
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.response?.data?.error || error.message };
    }
  },

  eliminarArea: async (id) => {
    try {
      await areasAPI.eliminar(id);
      set((state) => ({ areas: state.areas.filter((a) => a.id !== id) }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.response?.data?.error || error.message };
    }
  },

  clearError: () => set({ error: null }),

  // ─── ASIGNACIONES ────────────────────────────────────────────────
  // Lectura del listado de asignaciones con caché/invalidación (Req. 10.1, 10.2).
  cargarAsignaciones: async (opts = {}) => {
    const { force = false, params } = opts;
    if (!force && !params && !get().asignacionesDirty) {
      return { ok: true, cached: true };
    }
    set({ loading: true, error: null });
    try {
      const response = await asignacionesAPI.listar(params);
      const { data, pagination } = unwrapList(response.data);
      set({
        asignaciones: data,
        asignacionesPagination: pagination || { ...emptyPagination },
        asignacionesDirty: false,
        loading: false,
      });
      return { ok: true, cached: false };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { ok: false, error: error.message };
    }
  },

  crearAsignacion: async (data) => {
    try {
      const response = await asignacionesAPI.crear(data);
      const nueva = response.data?.data || response.data;
      const resActivo = await activosAPI.obtener(data.serie_activo);
      const actualizado = resActivo.data?.data || resActivo.data;
      // Una asignación toca activos y asignaciones: invalidar ambos dominios.
      set((state) => ({
        activos: state.activos.map(a => a.serie === data.serie_activo ? { ...a, ...actualizado } : a),
        activosDirty: true,
        asignacionesDirty: true,
      }));
      return { ok: true, data: nueva };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      return { ok: false, error: msg };
    }
  },

  cerrarAsignacion: async (id, data) => {
    try {
      const { activos } = get();
      const activoAfectado = activos.find(a => a.asignacion_id === id);
      const response = await asignacionesAPI.cerrar(id, data);
      const cerrada = response.data?.data || response.data;
      if (activoAfectado) {
        const resActivo = await activosAPI.obtener(activoAfectado.serie);
        const actualizado = resActivo.data?.data || resActivo.data;
        set((state) => ({
          activos: state.activos.map(a => a.serie === activoAfectado.serie ? { ...a, ...actualizado } : a),
          activosDirty: true,
          asignacionesDirty: true,
        }));
      } else {
        const resActivos = await activosAPI.listar();
        const { data: listaActivos, pagination } = unwrapList(resActivos.data);
        set({
          activos: listaActivos,
          activosPagination: pagination || { ...emptyPagination },
          activosDirty: false,
          asignacionesDirty: true,
        });
      }
      return { ok: true, data: cerrada };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      return { ok: false, error: msg };
    }
  },

  cargarAsignacionesActivo: async (serie) => {
    try {
      const response = await asignacionesAPI.porActivo(serie);
      const { data } = unwrapList(response.data);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, data: [] };
    }
  },

  cargarAsignacionesColab: async (rut) => {
    try {
      const response = await asignacionesAPI.porColab(rut);
      const { data } = unwrapList(response.data);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, data: [] };
    }
  },
}));
