import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token JWT automáticamente
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Autenticación
export const authAPI = {
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }),
  
  forgotPassword: (email) =>
    apiClient.post('/auth/forgot-password', { email }),
  
  resetPassword: (token, newPassword) =>
    apiClient.post('/auth/reset-password', { token, newPassword }),
};

// Activos
export const activosAPI = {
  listar: () => apiClient.get('/activos'),
  
  obtener: (serie) => apiClient.get(`/activos/${serie}`),
  
  crear: (data) => apiClient.post('/activos', data),
  
  actualizar: (serie, data) => apiClient.put(`/activos/${serie}`, data),
  
  eliminar: (serie) => apiClient.delete(`/activos/${serie}`),
};

// Colaboradores
export const colaboradoresAPI = {
  listar: () => apiClient.get('/colaboradores'),
  
  obtener: (rut) => apiClient.get(`/colaboradores/${rut}`),
  
  crear: (data) => apiClient.post('/colaboradores', data),
  
  actualizar: (rut, data) => apiClient.put(`/colaboradores/${rut}`, data),
};

// Usuarios (solo admin)
export const usuariosAPI = {
  listar: () => apiClient.get('/usuarios'),
  
  crear: (data) => apiClient.post('/usuarios', data),
};

export default apiClient;
