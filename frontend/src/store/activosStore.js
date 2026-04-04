import { create } from 'zustand';
import { activosAPI, colaboradoresAPI } from '../api';

export const useActivosStore = create((set) => ({
  activos: [],
  colaboradores: [],
  loading: false,
  error: null,

  cargarActivos: async () => {
    set({ loading: true, error: null });
    try {
      const response = await activosAPI.listar();
      set({ activos: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  cargarColaboradores: async () => {
    set({ loading: true, error: null });
    try {
      const response = await colaboradoresAPI.listar();
      set({ colaboradores: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  crearActivo: async (data) => {
    try {
      const response = await activosAPI.crear(data);
      set((state) => ({
        activos: [response.data.data, ...state.activos],
      }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      return false;
    }
  },

  actualizarActivo: async (serie, data) => {
    try {
      const response = await activosAPI.actualizar(serie, data);
      set((state) => ({
        activos: state.activos.map((a) =>
          a.serie === serie ? response.data.data : a
        ),
      }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      return false;
    }
  },

  eliminarActivo: async (serie) => {
    try {
      await activosAPI.eliminar(serie);
      set((state) => ({
        activos: state.activos.filter((a) => a.serie !== serie),
      }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      return false;
    }
  },

  crearColaborador: async (data) => {
    try {
      const response = await colaboradoresAPI.crear(data);
      set((state) => ({
        colaboradores: [response.data.data, ...state.colaboradores],
      }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message });
      return false;
    }
  },
}));
