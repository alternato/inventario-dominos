import { useState, useRef } from 'react';
import { buscarAPI } from '../api';
import { Search, Package, Users, Loader2, Laptop, Smartphone, Wifi, HardDrive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TIPO_ICON = {
  Laptop:     <Laptop className="w-4 h-4" />,
  Smartphone: <Smartphone className="w-4 h-4" />,
  'SIM Card': <Wifi className="w-4 h-4" />,
  Desktop:    <HardDrive className="w-4 h-4" />,
};

const ESTADO_COLOR = {
  Asignado:      'bg-green-100 text-green-700',
  Disponible:    'bg-yellow-100 text-yellow-700',
  Mantenimiento: 'bg-red-100 text-red-700',
  Descartado:    'bg-gray-100 text-gray-600',
};

export const BusquedaPage = () => {
  const [query, setQuery]         = useState('');
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const timer = useRef(null);

  const buscar = async (q) => {
    if (q.trim().length < 2) { setResultados(null); return; }
    setLoading(true); setError('');
    try {
      const { data } = await buscarAPI.buscar(q.trim());
      setResultados(data);
    } catch (e) {
      setError('Error al buscar. Inténtalo de nuevo.');
      setResultados(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => buscar(q), 400);
  };

  const totalResultados = resultados
    ? (resultados.activos?.length || 0) + (resultados.colaboradores?.length || 0)
    : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Búsqueda Global</h1>
        <p className="text-gray-500 mt-1">Busca activos y colaboradores en un solo lugar</p>
      </div>

      {/* Barra de búsqueda */}
      <div className="relative">
        {loading
          ? <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin" />
          : <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        }
        <input
          type="text"
          autoFocus
          placeholder="Buscar por nombre, RUT, serie, IMEI, número SIM, modelo, marca, teléfono..."
          value={query}
          onChange={handleChange}
          className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-primary outline-none shadow-sm transition"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResultados(null); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
          >×</button>
        )}
      </div>

      {/* Pistas de búsqueda */}
      {!query && (
        <div className="bg-gray-50 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-600 mb-3">Puedes buscar por:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ['📛 Nombre / Apellido', 'Juan Pérez'],
              ['🪪 RUT', '12.345.678-9'],
              ['🔢 N° de Serie', 'SN123456'],
              ['📱 IMEI', '358240051111110'],
              ['📶 N° SIM', '+56912345678'],
              ['💻 Modelo / Marca', 'ThinkPad, iPhone'],
            ].map(([label, ej]) => (
              <div key={label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                <p className="text-xs font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">Ej: {ej}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Resultados */}
      {resultados && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {totalResultados === 0
              ? `Sin resultados para "${query}"`
              : `${totalResultados} resultado(s) para "${query}"`}
          </p>

          {/* Activos */}
          {resultados.activos?.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                <Package className="w-4 h-4" /> Activos ({resultados.activos.length})
              </h2>
              <div className="space-y-2">
                {resultados.activos.map((a) => (
                  <div key={a.serie} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-4 hover:shadow-md transition">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center flex-shrink-0">
                      {TIPO_ICON[a.tipo_dispositivo] || <Package className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{a.marca} {a.modelo}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[a.estado] || 'bg-gray-100'}`}>
                          {a.estado}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {a.tipo_dispositivo}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span>Serie: <span className="font-mono">{a.serie}</span></span>
                        {a.imei && <span>IMEI: <span className="font-mono">{a.imei}</span></span>}
                        {a.numero_sim && <span>SIM: <span className="font-mono">{a.numero_sim}</span></span>}
                        {a.colaborador_nombre && <span>👤 {a.colaborador_nombre}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Colaboradores */}
          {resultados.colaboradores?.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                <Users className="w-4 h-4" /> Colaboradores ({resultados.colaboradores.length})
              </h2>
              <div className="space-y-2">
                {resultados.colaboradores.map((c) => (
                  <div key={c.rut} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md transition">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {c.nombre?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{c.nombre}</p>
                      <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="font-mono">{c.rut}</span>
                        <span>{c.area}</span>
                        {c.cargo && <span>{c.cargo}</span>}
                        {c.telefono && <span>📞 {c.telefono}</span>}
                        {c.correo && <span>✉️ {c.correo}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {totalResultados === 0 && (
            <div className="bg-white rounded-xl shadow text-center py-12">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-500 font-medium">Sin resultados</p>
              <p className="text-sm text-gray-400 mt-1">Prueba con otro término de búsqueda</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
