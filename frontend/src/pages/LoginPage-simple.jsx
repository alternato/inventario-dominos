import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { getMsalInstance } from '../msalInstance';
import { loginRequest } from '../authConfig';

// Teclado numérico en pantalla
const NumericKeypad = ({ onPress, onDelete, onClear }) => {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];
  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {keys.map((k, i) => {
        if (k === null) return <div key={i} />;
        if (k === 'del') return (
          <button
            key={i}
            onClick={onDelete}
            className="bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-xl h-14 flex items-center justify-center text-gray-500 font-bold text-lg transition-all"
          >
            ⌫
          </button>
        );
        return (
          <button
            key={i}
            onClick={() => onPress(k.toString())}
            className="bg-gray-50 hover:bg-blue-50 active:scale-95 border border-gray-200 hover:border-blue-300 rounded-xl h-14 flex items-center justify-center text-gray-800 font-semibold text-xl transition-all shadow-sm"
          >
            {k}
          </button>
        );
      })}
    </div>
  );
};

// Indicador de puntos del PIN
const PinDots = ({ length, filled }) => (
  <div className="flex justify-center gap-3 my-4">
    {Array.from({ length }).map((_, i) => (
      <div
        key={i}
        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
          i < filled ? 'bg-[#0070bc] border-[#0070bc] scale-110' : 'bg-transparent border-gray-300'
        }`}
      />
    ))}
  </div>
);

// Logo Domino's
const DominosLogo = () => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Domino%27s_pizza_logo.svg"
    alt="Domino's Pizza"
    style={{ width: '80px', height: 'auto', objectFit: 'contain' }}
  />
);

export const LoginPage = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'pin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const PIN_MAX = 6;

  // 🔐 EFECTO: Manejar el regreso de Microsoft (Redirect Callback)
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const instance = await getMsalInstance();
        const response = await instance.handleRedirectPromise();
        
        if (response && response.account) {
          setLoading(true);
          const email = response.account.username.toLowerCase();
          const msToken = response.idToken;

          const res = await authAPI.ssoLogin(email, msToken);
          const { usuario } = res.data;

          localStorage.setItem('usuario', JSON.stringify(usuario));
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
      const instance = await getMsalInstance();
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.error("Login SSO Error:", err);
      setError('Error de comunicación con Microsoft');
    } finally {
      setLoading(false);
    }
  };

  const handlePinPress = (digit) => {
    if (pin.length < PIN_MAX) setPin(p => p + digit);
  };
  const handlePinDelete = () => setPin(p => p.slice(0, -1));

  // Auto-envío cuando el PIN alcanza la longitud máxima
  const handlePinComplete = useCallback(async (fullPin) => {
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.pinLogin(fullPin);
      const { usuario } = response.data;
      localStorage.setItem('usuario', JSON.stringify(usuario));
      if (onLoginSuccess) onLoginSuccess();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'PIN incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [onLoginSuccess, navigate]);

  const handlePinDigit = useCallback((digit) => {
    setPin(prev => {
      if (prev.length >= PIN_MAX) return prev;
      const next = prev + digit;
      if (next.length === PIN_MAX) {
        setTimeout(() => handlePinComplete(next), 200);
      }
      return next;
    });
  }, [handlePinComplete]);

  // Soporte de teclado físico para el PIN
  useEffect(() => {
    if (activeTab !== 'pin') return;
    const handleKey = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        setPin(p => p.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeTab, handlePinDigit]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.login(email, password);
      const { usuario } = response.data;
      localStorage.setItem('usuario', JSON.stringify(usuario));
      if (onLoginSuccess) onLoginSuccess();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0070bc' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">

        {/* Logo Domino's */}
        <div className="flex justify-center mb-6">
          <DominosLogo />
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setActiveTab('manual'); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'manual'
                ? 'bg-white shadow text-[#0070bc]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Acceder Manual
          </button>
          <button
            onClick={() => { setActiveTab('pin'); setError(''); setPin(''); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'pin'
                ? 'bg-white shadow text-[#0070bc]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔢 Acceso PIN
          </button>
        </div>

        {/* ─── TAB: MANUAL ─── */}
        {activeTab === 'manual' && (
          <div>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email corporativo"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0070bc] focus:border-transparent outline-none transition"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Clave TI Local"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0070bc] focus:border-transparent outline-none transition"
                required
              />
              {error && (
                <p className="text-red-500 text-xs text-center font-medium">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#E31837] hover:bg-red-700 text-white font-bold py-3 rounded-xl uppercase tracking-widest text-sm transition disabled:opacity-50"
              >
                {loading ? 'Cargando...' : 'Acceder Manualmente'}
              </button>
            </form>
          </div>
        )}

        {/* ─── TAB: PIN ─── */}
        {activeTab === 'pin' && (
          <div>
            <p className="text-center text-sm text-gray-500 font-medium mb-1">
              Ingresa tu PIN de acceso
            </p>
            <PinDots length={PIN_MAX} filled={pin.length} />

            {error && (
              <p className="text-red-500 text-xs text-center font-medium mb-2 animate-pulse">{error}</p>
            )}

            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin w-8 h-8 border-4 border-[#0070bc] border-t-transparent rounded-full" />
              </div>
            ) : (
              <NumericKeypad
                onPress={handlePinDigit}
                onDelete={handlePinDelete}
              />
            )}

            {pin.length > 0 && !loading && (
              <button
                onClick={() => { setPin(''); setError(''); }}
                className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition text-center font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
        )}

        {/* ─── BOTÓN SSO (MICROSOFT) ─── */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">
            Ingreso Corporativo
          </p>
          <button
            onClick={handleSSO}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-[#0070bc] hover:bg-blue-50 text-gray-600 font-bold py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span className="text-sm">Iniciar sesión con Microsoft</span>
          </button>
          
          <p className="text-center mt-6 text-[10px] text-gray-400 font-medium">
            © 2026 Domino's Pizza Chile <br/> 
            <span className="font-bold">VOLTA</span> - Gestión de Inventario TI
          </p>
        </div>

      </div>
    </div>
  );
};
