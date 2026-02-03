import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Menu,
  X,
  Home,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout, usuario, isAdmin } = useAuthStore();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/activos', label: 'Activos', icon: Package },
    { path: '/colaboradores', label: 'Colaboradores', icon: Users },
    ...(isAdmin() ? [{ path: '/reportes', label: 'Reportes', icon: BarChart3 }] : []),
    ...(isAdmin() ? [{ path: '/usuarios', label: 'Usuarios', icon: Settings }] : []),
  ];

  return (
    <>
      {/* Botón hamburguesa móvil */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-primary text-white rounded-lg"
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-primary to-blue-900 text-white p-6 transform transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="mb-8">
          <h1 className="text-2xl font-bold">TI Maestro</h1>
          <p className="text-blue-100 text-xs">Domino's Pizza Chile</p>
        </div>

        {/* Menú */}
        <nav className="space-y-2 flex-1">
          {menuItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive(path)
                  ? 'bg-secondary text-white font-semibold'
                  : 'text-blue-100 hover:bg-blue-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Usuario */}
        <div className="border-t border-blue-700 pt-4">
          <div className="bg-blue-800 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-200">Sesión de</p>
            <p className="font-semibold text-sm truncate">{usuario?.nombre}</p>
            <p className="text-xs text-blue-200">{usuario?.rol}</p>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-blue-100 hover:bg-red-600 hover:text-white rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
