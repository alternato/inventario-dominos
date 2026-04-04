import { create } from 'zustand';
import { authAPI } from '../api';

export const useAuthStore = create((set) => ({
  usuario: localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')) : null,
  token: localStorage.getItem('authToken') || null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.login(email, password);
      const { token, usuario } = response.data;
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('usuario', JSON.stringify(usuario));
      
      set({ usuario, token, loading: false });
      return true;
    } catch (error) {
      const message = error.response?.data?.error || 'Error en login';
      set({ error: message, loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('usuario');
    set({ usuario: null, token: null, error: null });
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  isAdmin: () => {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    return usuario.rol === 'admin';
  },
}));
