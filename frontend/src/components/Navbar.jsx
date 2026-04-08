import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Menu, X, Package, Home, Users, Clock, Search, Settings, Power } from 'lucide-react';

export const Navbar = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { logout, usuario, isAdmin, isSuperAdmin } = useAuthStore();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    if (onLogout) onLogout();
  };

  const menuItems = [
    { path: '/', label: 'DASHBOARD' },
    { path: '/activos', label: 'ACTIVOS' },
    { path: '/colaboradores', label: 'COLABORADORES' },
    { path: '/historial', label: 'HISTORIAL' },
    { path: '/buscar', label: 'BÚSQUEDA' },
    ...(isSuperAdmin() ? [{ path: '/usuarios', label: 'USUARIOS' }] : []),
  ];

  return (
    <nav className="bg-[#008ce7] text-white shadow-md relative z-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 flex items-center justify-between h-16">
        
        {/* LOGO AREA */}
        <div className="flex items-center gap-2">
          <img src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Domino%27s_pizza_logo.svg" alt="Domino's logo" className="w-8 h-8 object-contain shrink-0" />
          <span className="font-black text-xl tracking-tight ml-2 mr-4">VOLTA</span>
        </div>

        {/* DESKTOP LINKS */}
        <div className="hidden md:flex flex-1 items-center space-x-6 px-4">
          {menuItems.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`text-xs font-bold uppercase tracking-wide px-2 py-5 border-b-4 transition-colors ${
                isActive(path)
                  ? 'border-white text-white'
                  : 'border-transparent text-blue-100 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* RIGHT AREA (USER INFO & LOGOUT) */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-right leading-tight">
            <span className="block text-[10px] font-bold text-blue-200 uppercase tracking-widest">{usuario?.rol || 'USER'}</span>
            <span className="block text-sm font-semibold">{usuario?.nombre || 'Usuario'}</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 bg-[#E31837] hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all shadow-md active:scale-95"
            title="Cerrar Sesión"
          >
            <Power className="w-3.5 h-3.5" />
            <span>CERRAR SESIÓN</span>
          </button>
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className="md:hidden flex items-center">
          <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-white">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isOpen && (
        <div className="md:hidden bg-[#008ce7] border-t border-blue-400 absolute w-full left-0 shadow-xl">
          <div className="px-4 py-3 space-y-2">
            {menuItems.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setIsOpen(false)}
                className={`block px-3 py-2 rounded-md font-bold text-sm ${
                  isActive(path) ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-blue-400 mt-2 pt-2 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-blue-200 uppercase">{usuario?.rol || 'USER'}</span>
                <span className="text-sm font-semibold">{usuario?.nombre}</span>
              </div>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 px-3 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm text-xs font-bold uppercase tracking-wider transition-colors"
                title="Cerrar Sesión"
              >
                <Power className="w-4 h-4" />
                <span>CERRAR SESIÓN</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
