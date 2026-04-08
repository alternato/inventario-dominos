// frontend/src/store/authStore.js - MEJORADO CON HTTPONLYJ COOKIES

import { create } from 'zustand';
import { authAPI } from '../api';

export const useAuthStore = create((set, get) => ({
  // ✅ MEJORADO: Solo guardamos usuario, NO el token (está en httpOnly cookie)
  usuario: localStorage.getItem('usuario') 
    ? JSON.parse(localStorage.getItem('usuario')) 
    : null,
  loading: false,
  error: null,

  // Login
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await authAPI.login(email, password);
      const { usuario } = response.data;
      
      // ✅ CAMBIO: NO guardamos token en localStorage
      // El token viene en httpOnly cookie automáticamente
      localStorage.setItem('usuario', JSON.stringify(usuario));
      
      set({ usuario, loading: false });
      return true;
    } catch (error) {
      const message = error.response?.data?.error || 'Error en login';
      set({ error: message, loading: false });
      return false;
    }
  },

  // ✅ MEJORADO: Logout completo
  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Error al logout:', error);
    } finally {
      // Limpiar todo
      localStorage.removeItem('usuario');
      localStorage.removeItem('authToken');
      set({ usuario: null, error: null });
    }
  },

  // Verificar si está autenticado
  isAuthenticated: () => {
    return !!localStorage.getItem('usuario');
  },

  // Verificar si es admin
  isAdmin: () => {
    const usuario = get().usuario;
    return usuario?.rol === 'admin' || usuario?.rol === 'superadministrador';
  },

  // Verificar si es superadministrador
  isSuperAdmin: () => {
    const usuario = get().usuario;
    return usuario?.rol === 'superadministrador';
  },

  // ✅ NUEVO: Verificar con backend
  verify: async () => {
    try {
      const response = await authAPI.verify();
      const { usuario } = response.data;
      set({ usuario });
      return true;
    } catch (error) {
      // Si hay error, limpiar
      localStorage.removeItem('usuario');
      set({ usuario: null });
      return false;
    }
  },

  // Limpiar error
  clearError: () => set({ error: null }),
  
  // Establecer usuario
  setUsuario: (usuario) => set({ usuario }),
}));