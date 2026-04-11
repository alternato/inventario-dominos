import axios from 'axios';

// En producción usamos ruta relativa (/api) para que Nginx haga el proxy al backend.
// En desarrollo usamos localhost:8081 directamente.
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:8081/api');

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Las cookies httpOnly son enviadas automáticamente por axios con withCredentials: true
// No se inyecta Authorization header — el backend lee req.cookies.authToken

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Solo limpiar la sesión local. 
      // El redireccionamiento lo maneja React Router (Navigate to="/login") en App.jsx
      // para evitar recargas completas (loops) del navegador de forma garantizada.
      localStorage.removeItem('authToken');
      localStorage.removeItem('usuario');
    }
    return Promise.reject(error);
  }
);

// ─── AUTH ───────────────────────────────────────────────────
export const authAPI = {
  login:         (email, password) => apiClient.post('/auth/login', { email, password }),
  ssoLogin:      (email, msToken)  => apiClient.post('/auth/sso-login', { email, msToken }),
  pinLogin:      (pin)             => apiClient.post('/auth/pin-login', { pin }),
  logout:        ()                => apiClient.post('/auth/logout'),
  verify:        ()                => apiClient.get('/auth/verify'),
  forgotPassword:(email)           => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => apiClient.post('/auth/reset-password', { token, newPassword }),
};

// ─── ACTIVOS ────────────────────────────────────────────────
export const activosAPI = {
  listar:     ()           => apiClient.get('/activos'),
  obtener:    (serie)      => apiClient.get(`/activos/${encodeURIComponent(serie)}`),
  crear:      (data)       => apiClient.post('/activos', data),
  actualizar: (serie, data)=> apiClient.put(`/activos/${encodeURIComponent(serie)}`, data),
  eliminar:   (serie)      => apiClient.delete(`/activos/${encodeURIComponent(serie)}`),
  historial:  (serie)      => apiClient.get(`/activos/${encodeURIComponent(serie)}/historial`),
  importarPreview: (rows) => apiClient.post('/import/preview', { rows }),
  importarCommit:  (rows) => apiClient.post('/import/commit', { rows })
};

// ─── COLABORADORES ──────────────────────────────────────────
export const colaboradoresAPI = {
  listar:     ()          => apiClient.get('/colaboradores'),
  obtener:    (rut)       => apiClient.get(`/colaboradores/${rut}`),
  crear:      (data)      => apiClient.post('/colaboradores', data),
  actualizar: (rut, data) => apiClient.put(`/colaboradores/${rut}`, data),
  eliminar:   (rut)       => apiClient.delete(`/colaboradores/${rut}`),
  activos:    (rut)       => apiClient.get(`/colaboradores/${rut}/activos`),
};

// ─── HISTORIAL ──────────────────────────────────────────────
export const historialAPI = {
  listar: (params = {}) => apiClient.get('/historial', { params }),
};

// ─── BÚSQUEDA ───────────────────────────────────────────────
export const buscarAPI = {
  buscar: (q) => apiClient.get('/buscar', { params: { q } }),
};

// ─── KPIs ───────────────────────────────────────────────────
export const kpisAPI = {
  obtener: () => apiClient.get('/kpis'),
};

// ─── USUARIOS (ADMIN) ───────────────────────────────────────
export const usuariosAPI = {
  listar:     ()           => apiClient.get('/usuarios'),
  crear:      (data)       => apiClient.post('/usuarios', data),
  actualizar: (id, data)   => apiClient.put(`/usuarios/${id}`, data),
  setPin:     (id, pin)    => apiClient.post(`/usuarios/${id}/set-pin`, { pin }),
};

export default apiClient;