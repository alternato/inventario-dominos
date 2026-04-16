import { create } from 'zustand';
import { activosAPI, colaboradoresAPI, areasAPI } from '../api';

export const useActivosStore = create((set, get) => ({
  activos: [],
  colaboradores: [],
  areas: [],
  loading: false,
  error: null,

  // ─── ACTIVOS ────────────────────────────────────────────
  cargarActivos: async () => {
    set({ loading: true, error: null });
    try {
      const response = await activosAPI.listar();
      set({ activos: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  crearActivo: async (data) => {
    try {
      const response = await activosAPI.crear(data);
      const nuevo = response.data?.data || response.data;
      set((state) => ({ activos: [nuevo, ...state.activos] }));
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
      set((state) => ({ activos: state.activos.filter((a) => a.serie !== serie) }));
      return { ok: true };
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }
  },

  // ─── COLABORADORES ──────────────────────────────────────
  cargarColaboradores: async () => {
    set({ loading: true, error: null });
    try {
      const response = await colaboradoresAPI.listar();
      set({ colaboradores: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  crearColaborador: async (data) => {
    try {
      const response = await colaboradoresAPI.crear(data);
      const nuevo = response.data?.data || response.data;
      set((state) => ({ colaboradores: [nuevo, ...state.colaboradores] }));
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
      set((state) => ({ colaboradores: state.colaboradores.filter((c) => c.rut !== rut) }));
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
      set({ areas: response.data });
    } catch (error) {
      console.error('Error al cargar áreas:', error);
    }
  },

  crearArea: async (nombre) => {
    try {
      const response = await areasAPI.crear(nombre);
      set((state) => ({ areas: [...state.areas, response.data] }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.response?.data?.error || error.message };
    }
  },

  actualizarArea: async (id, nombre) => {
    try {
      const response = await areasAPI.actualizar(id, nombre);
      set((state) => ({
        areas: state.areas.map((a) => (a.id === id ? response.data : a)),
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
}));
