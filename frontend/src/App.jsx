import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LoginPage } from './pages/LoginPage-simple';
import { Dashboard } from './pages/Dashboard';
import { ActivosPage } from './pages/ActivosPage';
import { ColaboradoresPage } from './pages/ColaboradoresPage';
import { HistorialPage } from './pages/HistorialPage';
import { BusquedaPage } from './pages/BusquedaPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { Layout } from './components/Layout';
import { authAPI } from './api';
import { useAuthStore } from './store/authStore';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isSuperAdmin, setUsuario } = useAuthStore();

  useEffect(() => {
    // Verificar sesión contra el backend — no confiar solo en localStorage
    authAPI.verify()
      .then(res => {
        // Actualizar localStorage Y el store de Zustand con los datos frescos del servidor
        if (res.data?.usuario) {
          localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
          setUsuario(res.data.usuario); // 👈 Esto actualiza el Navbar en tiempo real
        }
        setIsAuthenticated(true);
      })
      .catch(() => {
        // Token inválido/expirado: limpiar localStorage
        localStorage.removeItem('authToken');
        localStorage.removeItem('usuario');
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLoginSuccess = () => setIsAuthenticated(true);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('usuario');
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const ProtectedRoute = ({ children }) =>
    isAuthenticated ? <Layout onLogout={handleLogout}>{children}</Layout> : <Navigate to="/login" replace />;

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated
            ? <Navigate to="/" replace />
            : <LoginPage onLoginSuccess={handleLoginSuccess} />
          }
        />
        <Route path="/"              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/activos"       element={<ProtectedRoute><ActivosPage /></ProtectedRoute>} />
        <Route path="/colaboradores" element={<ProtectedRoute><ColaboradoresPage /></ProtectedRoute>} />
        <Route path="/historial"     element={<ProtectedRoute><HistorialPage /></ProtectedRoute>} />
        <Route path="/buscar"        element={<ProtectedRoute><BusquedaPage /></ProtectedRoute>} />
        <Route path="/usuarios"      element={<ProtectedRoute>{isSuperAdmin() ? <UsuariosPage /> : <Navigate to="/" replace />}</ProtectedRoute>} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
