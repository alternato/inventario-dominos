import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LoginPage } from './pages/LoginPage-simple';
import { Dashboard } from './pages/Dashboard';
import { ActivosPage } from './pages/ActivosPage';
import { ColaboradoresPage } from './pages/ColaboradoresPage';
import { Layout } from './components/Layout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
          } 
        />
        
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : <Navigate to="/login" replace />
          } 
        />

        <Route 
          path="/activos" 
          element={
            isAuthenticated ? (
              <Layout>
                <ActivosPage />
              </Layout>
            ) : <Navigate to="/login" replace />
          } 
        />

        <Route 
          path="/colaboradores" 
          element={
            isAuthenticated ? (
              <Layout>
                <ColaboradoresPage />
              </Layout>
            ) : <Navigate to="/login" replace />
          } 
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
