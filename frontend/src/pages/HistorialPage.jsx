import { useState, useEffect } from 'react';
import { historialAPI } from '../api';
import { Clock, Package, ArrowRight, Filter, Download } from 'lucide-react';

const TIPOS_COLOR = {
  asignacion:    'bg-green-100 text-green-800 border-green-200',
  devolucion:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  cambio_estado: 'bg-blue-100 text-blue-800 border-blue-200',
  creacion:      'bg-purple-100 text-purple-800 border-purple-200',
  baja:          'bg-red-100 text-red-800 border-red-200',
  reparacion:    'bg-orange-100 text-orange-800 border-orange-200',
};

const TIPOS_LABEL = {
  asignacion:    '📥 Asignación',
  devolucion:    '📤 Devolución',
  cambio_estado: '🔄 Cambio de estado',
  creacion:      '✨ Alta de equipo',
  baja:          '🗑️ Baja',
  reparacion:    '🔧 Reparación',
};

export const HistorialPage = () => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filtros, setFiltros]     = useState({ serie: '', rut: '', desde: '', hasta: '' });
  const [aplicados, setAplicados] = useState({});

  const cargar = async (params = {}) => {
    setLoading(true);
    try {
      const { data } = await historialAPI.listar(params);
      setHistorial(data);
    } catch (e) {
      setHistorial([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const aplicarFiltros = () => {
    const params = {};
    if (filtros.serie) params.serie = filtros.serie;
    if (filtros.rut)   params.rut   = filtros.rut;
    if (filtros.desde) params.desde = filtros.desde;
    if (filtros.hasta) params.hasta = filtros.hasta;
    setAplicados(params);
    cargar(params);
  };

  const limpiarFiltros = () => {
    setFiltros({ serie: '', rut: '', desde: '', hasta: '' });
    setAplicados({});
    cargar();
  };

  const formatFecha = (f) => {
    if (!f) return '—';
    return new Date(f).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Historial de Trazabilidad</h1>
        <p className="text-gray-500 mt-1">Registro completo de movimientos de equipos</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">N° Serie / Equipo</label>
            <input
              type="text" placeholder="Ej: SN12345"
              value={filtros.serie}
              onChange={e => setFiltros(f => ({ ...f, serie: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">RUT Colaborador</label>
            <input
              type="text" placeholder="Ej: 12.345.678-9"
              value={filtros.rut}
              onChange={e => setFiltros(f => ({ ...f, rut: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={aplicarFiltros} className="px-4 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-blue-700 transition">
            Filtrar
          </button>
          <button onClick={limpiarFiltros} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition">
            Limpiar
          </button>
        </div>
      </div>

      {/* Estadística rápida */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {loading ? 'Cargando...' : `${historial.length} registro(s) encontrado(s)`}
        </span>
      </div>

      {/* Timeline / Tabla */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : historial.length === 0 ? (
        <div className="bg-white rounded-xl shadow text-center py-16">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Sin registros de historial</p>
          <p className="text-sm text-gray-400 mt-1">
            {Object.keys(aplicados).length > 0
              ? 'Intenta con otros filtros'
              : 'Los movimientos de equipos aparecerán aquí automáticamente'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Equipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Movimiento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historial.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatFecha(h.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {h.marca} {h.modelo || h.serie}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">{h.serie}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-500">{h.tipo_dispositivo || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${TIPOS_COLOR[h.tipo_movimiento] || 'bg-gray-100 text-gray-600'}`}>
                        {TIPOS_LABEL[h.tipo_movimiento] || h.tipo_movimiento}
                      </span>
                      {(h.nombre_anterior || h.nombre_nuevo) && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>{h.nombre_anterior || '(sin asignar)'}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-medium">{h.nombre_nuevo || '(sin asignar)'}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(h.estado_anterior || h.estado_nuevo) && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>{h.estado_anterior || '—'}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="font-medium">{h.estado_nuevo || '—'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {h.registrado_por || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
