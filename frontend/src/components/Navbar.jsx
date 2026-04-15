import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Menu, X, Power } from 'lucide-react';
import { getMsalInstance } from '../msalInstance';

// ─── Foto del usuario logueado desde Microsoft Graph ─────────────────────────
const UserPhoto = ({ email, nombre }) => {
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!email) return;
    const fetchPhoto = async () => {
      try {
        const msal = await getMsalInstance();
        const accounts = msal.getAllAccounts();
        if (accounts.length === 0) return;
        const tokenResp = await msal.acquireTokenSilent({
          scopes: ['User.Read'],
          account: accounts[0],
        });
        // Foto del propio usuario logueado
        const resp = await fetch(
          'https://graph.microsoft.com/v1.0/me/photo/$value',
          { headers: { Authorization: `Bearer ${tokenResp.accessToken}` } }
        );
        if (resp.ok) {
          const blob = await resp.blob();
          setPhotoUrl(URL.createObjectURL(blob));
        }
      } catch {
        // Sin foto: muestra iniciales
      }
    };
    fetchPhoto();
  }, [email]);

  const inicial = nombre?.charAt(0).toUpperCase() || '?';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={nombre}
        className="w-8 h-8 rounded-full object-cover ring-2 ring-white/40 shadow-sm flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-white/20 ring-2 ring-white/40 flex items-center justify-center text-sm font-black text-white flex-shrink-0">
      {inicial}
    </div>
  );
};

// ─── Navbar principal ─────────────────────────────────────────────────────────
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
    <nav
      className="relative z-50 text-white"
      style={{
        background: '#008ce7',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.12), inset 2px 0 0 rgba(255,255,255,0.15), inset -2px 0 0 rgba(255,255,255,0.15), 0 4px 16px rgba(0,100,200,0.35)'
      }}
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 flex items-center justify-between h-16">

        {/* LOGO AREA */}
        <div className="flex items-center gap-2">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Domino%27s_pizza_logo.svg"
            alt="Domino's logo"
            className="w-8 h-8 object-contain shrink-0"
          />
          <span
            className="font-black italic tracking-tighter text-[1.6rem] leading-none ml-1 mr-4 select-none"
          >
            <span style={{
              color: '#008ce7',
              textShadow: '0 0 6px white, 0 0 3px white, 1px 1px 0 white, -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white'
            }}>V</span><span style={{
              color: '#0f1c2e',
              textShadow: '0 0 6px white, 0 0 3px white, 1px 1px 0 white, -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white'
            }}>OLTA</span><span style={{ color: '#E31837', textShadow: '0 0 4px white' }}>.</span>
          </span>
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

        {/* RIGHT AREA (USER PHOTO, INFO & LOGOUT) */}
        <div className="hidden md:flex items-center gap-3">
          <UserPhoto email={usuario?.email} nombre={usuario?.nombre} />
          <div className="text-right leading-tight">
            <span className="block text-[10px] font-bold text-blue-100 uppercase tracking-widest">
              {usuario?.rol || 'USER'}
            </span>
            <span className="block text-sm font-semibold text-white">{usuario?.nombre || 'Usuario'}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-[#E31837] hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all shadow-md active:scale-95 ml-1"
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
        <div className="md:hidden bg-[#0080d4] border-t border-blue-400 absolute w-full left-0 shadow-xl">
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
              <div className="flex items-center gap-2">
                <UserPhoto email={usuario?.email} nombre={usuario?.nombre} />
                <div className="flex flex-col">
                  <span className="text-[10px] text-blue-200 uppercase font-bold">{usuario?.rol || 'USER'}</span>
                  <span className="text-sm font-semibold text-white">{usuario?.nombre}</span>
                </div>
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
