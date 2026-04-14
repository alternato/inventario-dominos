import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { getMsalInstance } from '../msalInstance';
import { loginRequest } from '../authConfig';
import { useAuthStore } from '../store/authStore';
import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const DominosLogo = () => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Domino%27s_pizza_logo.svg"
    alt="Domino's Pizza"
    className="w-16 h-auto drop-shadow-sm mb-6"
  />
);

export const LoginPage = ({ onLoginSuccess }) => {
  const [showLegacy, setShowLegacy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUsuario } = useAuthStore();

  // 🔐 EFECTO: Manejar el regreso de Microsoft (Redirect Callback)
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        if (typeof getMsalInstance !== 'function') return;
        const instance = await getMsalInstance();
        const response = await instance.handleRedirectPromise();

        if (response && response.account) {
          setLoading(true);
          const email = response.account.username.toLowerCase();
          const msToken = response.idToken;

          const res = await authAPI.ssoLogin(email, msToken);
          const { usuario } = res.data;

          localStorage.setItem('usuario', JSON.stringify(usuario));
          setUsuario(usuario);
          if (onLoginSuccess) onLoginSuccess();
          navigate('/');
        }
      } catch (err) {
        console.error("MSAL Redirect Error:", err);
        setError('Error al procesar el retorno de Microsoft');
      } finally {
        setLoading(false);
      }
    };

    handleRedirect();
  }, [navigate, onLoginSuccess]);

  const handleSSO = async () => {
    setError('');
    setLoading(true);
    try {
      if (typeof getMsalInstance !== 'function') {
        setError('SSO no disponible. Recarga la página.');
        return;
      }
      const instance = await getMsalInstance();
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.error("Login SSO Error:", err);
      setError('Error de comunicación con Microsoft');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login(email, password);
      const { usuario } = response.data;
      localStorage.setItem('usuario', JSON.stringify(usuario));
      setUsuario(usuario);
      if (onLoginSuccess) onLoginSuccess();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      
      {/* ─── PANE IZQUIERDO: Branding VOLTA (Oculto en Móvil) ─── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-center px-16 bg-gray-900 border-r border-gray-800">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#0070bc] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-t from-black outline-none via-transparent to-transparent opacity-80" />
        </div>

        <div className="relative z-10 w-full max-w-xl">
          <h2 className="text-blue-500 font-bold tracking-[0.3em] text-sm mb-4 uppercase">Bienvenido a</h2>
          
          <h1 className="text-white text-7xl md:text-8xl font-black italic tracking-tighter mb-6 relative hover:scale-105 transition-transform duration-700 ease-out" style={{ filter: 'drop-shadow(0 10px 20px rgba(0,112,188,0.3))' }}>
            <span className="text-[#0070bc]">V</span>OLTA<span className="text-[#E31837]">.</span>
          </h1>
          
          <p className="text-gray-300 text-lg md:text-xl font-light leading-relaxed mb-10 max-w-md">
            El sistema de <strong className="text-white font-semibold">Gestión de Inventario TI</strong> y Control de Activos. Todo el hardware corporativo en un mismo lugar, en tiempo real.
          </p>
          
          <div className="h-1 w-20 bg-gradient-to-r from-[#0070bc] to-[#E31837] rounded-full" />
        </div>
      </div>

      {/* ─── PANE DERECHO: Formulario de Acceso ─── */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center items-center px-6 sm:px-12 md:px-20 relative bg-white">
        
        <div className="w-full max-w-md">
          {/* Logo y Titular */}
          <div className="flex flex-col items-start mb-10">
            <DominosLogo />
            <h2 className="text-3xl font-black text-gray-900 mb-1 tracking-tight">ACCESO VOLTA.</h2>
            <p className="text-gray-500 font-medium text-sm">Inicia sesión en tu cuenta para continuar</p>
          </div>

          {/* Área de Errores Globales */}
          {error && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}

          {/* Botón SSO Microsoft */}
          <button
            onClick={handleSSO}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-[#0070bc] text-gray-700 font-bold py-4 rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-50 group mb-6"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#0070bc]" />
            ) : (
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
            )}
            <span>Cuenta Corporativa</span>
          </button>

          {/* Divisor Visual */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alternativa</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* Acordeón de Acceso Manual */}
          <div className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 bg-gray-50/50">
            <button
              onClick={() => setShowLegacy(!showLegacy)}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors focus:outline-none"
            >
              <span className="text-sm font-bold text-gray-700 tracking-wide">USUARIO Y CONTRASEÑA</span>
              {showLegacy ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            <div className={`transition-all duration-500 ease-in-out ${showLegacy ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
              <form onSubmit={handleManualSubmit} className="p-5 space-y-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 ml-1">
                    Email Local
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="TI@dominospizza.cl"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#0070bc] focus:border-transparent outline-none transition-shadow shadow-inner"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 ml-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#0070bc] focus:border-transparent outline-none transition-shadow shadow-inner"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#E31837] hover:bg-[#c9122f] text-white font-bold py-3.5 rounded-lg shadow-md hover:shadow-lg uppercase tracking-widest text-sm transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
                >
                  Acceder
                </button>
              </form>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
              © 2026 Domino's Pizza Chile
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
