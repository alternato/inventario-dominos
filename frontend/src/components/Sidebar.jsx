import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Menu, X, Home, Package, Users, Clock, Search, Settings, LogOut,
} from 'lucide-react';

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout, usuario, isAdmin } = useAuthStore();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { path: '/',              label: 'Dashboard',   icon: Home    },
    { path: '/activos',       label: 'Activos',     icon: Package },
    { path: '/colaboradores', label: 'Colaboradores', icon: Users },
    { path: '/historial',     label: 'Historial',   icon: Clock   },
    { path: '/buscar',        label: 'Búsqueda',    icon: Search  },
    ...(isAdmin() ? [{ path: '/usuarios', label: 'Usuarios', icon: Settings }] : []),
  ];

  return (
    <>
      {/* Botón hamburguesa móvil */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-primary text-white rounded-lg shadow"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-[#1e3a5f] to-[#0f2340] text-white p-5 flex flex-col transform transition-transform duration-300 z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        
        {/* Logo */}
        <div className="mb-8 px-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-bold">VOLTA</h1>
          </div>
          <p className="text-blue-300 text-xs pl-10">Domino's Pizza Chile</p>
        </div>

        {/* Menú */}
        <nav className="flex-1 space-y-1">
          {menuItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition font-medium ${
                isActive(path)
                  ? 'bg-primary text-white shadow'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Usuario */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
              {usuario?.nombre?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{usuario?.nombre}</p>
              <p className="text-xs text-blue-300 capitalize">{usuario?.rol}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-blue-200 hover:bg-red-600/80 hover:text-white rounded-lg transition"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
};
