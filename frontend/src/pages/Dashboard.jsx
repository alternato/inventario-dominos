import { useEffect, useState, useMemo } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { kpisAPI } from '../api';
import { Package, Users, Activity, TrendingUp, Laptop, Smartphone, Wifi, Settings2, X, Check, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS_TIPO  = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#6B7280'];
const COLORS_ESTADO = { Asignado: '#10B981', Disponible: '#F59E0B', Mantenimiento: '#EF4444', Descartado: '#6B7280' };

export const Dashboard = () => {
  const { activos, cargarActivos } = useActivosStore();
  const { usuario } = useAuthStore();
  const [kpis, setKpis] = useState(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Widget visibility configuration
  const defaultWidgets = ['kpi-total', 'kpi-asignados', 'kpi-disponibles', 'kpi-mantenimiento', 'chart-tipo', 'chart-estado', 'list-colab', 'list-tipo'];
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const saved = localStorage.getItem('dashboardWidgets');
    return saved ? JSON.parse(saved) : defaultWidgets;
  });
  const [showConfig, setShowConfig] = useState(false);

  const toggleWidget = (id) => {
    const next = visibleWidgets.includes(id) 
      ? visibleWidgets.filter(w => w !== id)
      : [...visibleWidgets, id];
    setVisibleWidgets(next);
    localStorage.setItem('dashboardWidgets', JSON.stringify(next));
  };

  useEffect(() => {
    cargarActivos();
    kpisAPI.obtener()
      .then(r => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoadingKpis(false));
  }, []);

  // Calcular stats locales como fallback
  const stats = {
    total:        activos.length,
    asignados:    activos.filter(a => a.estado === 'Asignado').length,
    disponibles:  activos.filter(a => a.estado === 'Disponible').length,
    mantenimiento:activos.filter(a => a.estado === 'Mantenimiento').length,
  };

  const porTipo = kpis?.porTipo ?? Object.entries(
    activos.reduce((acc, a) => {
      acc[a.tipo_dispositivo] = (acc[a.tipo_dispositivo] || 0) + 1;
      return acc;
    }, {})
  ).map(([tipo_dispositivo, cantidad]) => ({ tipo_dispositivo, cantidad }));

  const porEstado = kpis?.porEstado ?? Object.entries(
    activos.reduce((acc, a) => {
      acc[a.estado] = (acc[a.estado] || 0) + 1;
      return acc;
    }, {})
  ).map(([estado, cantidad]) => ({ estado, cantidad }));

  const topColaboradores = kpis?.topColaboradores ?? [];

  const pct = stats.total > 0 ? Math.round((stats.asignados / stats.total) * 100) : 0;

  return (
    <div className="space-y-6 relative">
      {/* Botón y Panel de Configuración */}
      <div className="absolute top-2 right-4 md:right-8 z-20 flex justify-end">
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition shadow-sm"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Personalizar Vista
        </button>

        {showConfig && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 text-gray-800 z-50">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h3 className="text-sm font-bold">Ocultar/Mostrar Paneles</h3>
              <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 text-sm font-medium">
              {[
                { id: 'kpi-total', label: 'KPI Total Activos' },
                { id: 'kpi-asignados', label: 'KPI Asignados' },
                { id: 'kpi-disponibles', label: 'KPI Disponibles' },
                { id: 'kpi-mantenimiento', label: 'KPI Mantenimiento' },
                { id: 'chart-tipo', label: 'Gráfico Distribución' },
                { id: 'chart-estado', label: 'Gráfico por Estado' },
                { id: 'list-colab', label: 'Top Colaboradores' },
                { id: 'list-tipo', label: 'Resumen por Tipo' }
              ].map(w => (
                <label key={w.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleWidgets.includes(w.id) ? 'bg-[#008ce7] border-[#008ce7]' : 'border-gray-300'}`}>
                    {visibleWidgets.includes(w.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={visibleWidgets.includes(w.id)} onChange={() => toggleWidget(w.id)} />
                  <span className="text-gray-600">{w.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bienvenida (Jumbotron estilo Domino's COMPASS) */}
      <div className="bg-[#0070bc] text-white rounded-2xl p-8 md:p-10 relative overflow-hidden shadow-sm">
        {/* Adorno circular a la derecha */}
        <div className="absolute -right-10 -top-20 opacity-10 pointer-events-none">
           <svg width="300" height="300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
        </div>
        
        <div className="relative z-10">
          <p className="text-sm md:text-base font-semibold text-blue-100 mb-1">
            Hola, <span className="font-bold text-white">{usuario?.nombre || 'Administrador'} 👋</span>
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
            Inventario Activo
          </h1>
          <p className="text-5xl md:text-6xl font-black text-white mb-4">
            {stats.asignados} <span className="text-2xl font-bold text-blue-200">/ {stats.total}</span>
          </p>
          <p className="text-sm font-medium text-blue-100">
            Tienes <span className="font-bold text-white">{stats.asignados}</span> equipos asignados hoy ({pct}% del total general)
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleWidgets.includes('kpi-total') && <KpiCard title="Total Activos" value={stats.total} icon={Package} color="blue" sub={`${pct}% asignados`} />}
        {visibleWidgets.includes('kpi-asignados') && <KpiCard title="Asignados" value={stats.asignados} icon={Users} color="green" sub="En uso" />}
        {visibleWidgets.includes('kpi-disponibles') && <KpiCard title="Disponibles" value={stats.disponibles} icon={Activity} color="yellow" sub="Listos para asignar" />}
        {visibleWidgets.includes('kpi-mantenimiento') && <KpiCard title="Mantenimiento" value={stats.mantenimiento} icon={TrendingUp} color="red" sub="En revisión" />}
      </div>

      {/* Fila de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico Dinámico 1 */}
        {visibleWidgets.includes('chart-tipo') && (
          <DynamicChartPanel 
            id="chart1" 
            activos={activos} 
            defaultType="pie" 
            defaultGroupBy="tipo_dispositivo" 
          />
        )}

        {/* Gráfico Dinámico 2 */}
        {visibleWidgets.includes('chart-estado') && (
          <DynamicChartPanel 
            id="chart2" 
            activos={activos} 
            defaultType="bar" 
            defaultGroupBy="estado" 
          />
        )}
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top colaboradores */}
        {visibleWidgets.includes('list-colab') && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">Top Colaboradores con más Equipos</h2>
          {topColaboradores.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos suficientes</p>
          ) : (
            <div className="space-y-3">
              {topColaboradores.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.colaborador}</p>
                    <p className="text-xs text-gray-500">{c.area}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">{c.total_equipos}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Resumen tipos de dispositivos */}
        {visibleWidgets.includes('list-tipo') && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">Inventario por Tipo</h2>
          <div className="space-y-3">
            {porTipo.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin activos registrados</p>
            ) : (
              porTipo.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-700">{t.tipo_dispositivo}</span>
                      <span className="text-sm font-bold" style={{ color: COLORS_TIPO[i % COLORS_TIPO.length] }}>
                        {t.cantidad}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(t.cantidad / stats.total) * 100}%`,
                          backgroundColor: COLORS_TIPO[i % COLORS_TIPO.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon: Icon, color, sub }) => {
  const styles = {
    blue:   { b: 'border-[#0066CC]', t: 'text-[#0066CC]', txt: 'text-gray-500' },
    green:  { b: 'border-[#10B981]', t: 'text-[#10B981]', txt: 'text-green-600' },
    yellow: { b: 'border-[#F59E0B]', t: 'text-[#F59E0B]', txt: 'text-yellow-600' },
    red:    { b: 'border-[#E31837]', t: 'text-[#E31837]', txt: 'text-red-600' },
  };
  const s = styles[color] || styles.blue;
  
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 pl-6 border-l-[6px] ${s.b} hover:shadow-md transition relative overflow-hidden flex flex-col justify-between min-h-[140px]`}>
      <div>
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">{title}</p>
        <p className={`text-4xl font-extrabold ${s.t}`}>{value}</p>
      </div>
      <div>
        {sub && <p className={`text-sm font-semibold mt-4 ${s.txt}`}>{sub} ☝️</p>}
      </div>
    </div>
  );
};

const EmptyChart = () => (
  <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
    Sin datos para mostrar
  </div>
);

const DynamicChartPanel = ({ id, activos, defaultType, defaultGroupBy }) => {
  const [type, setType] = useState(() => localStorage.getItem(`${id}-type`) || defaultType);
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem(`${id}-groupBy`) || defaultGroupBy);

  const agruparPor = (val) => {
    setGroupBy(val);
    localStorage.setItem(`${id}-groupBy`, val);
  };
  const cambiarTipo = (val) => {
    setType(val);
    localStorage.setItem(`${id}-type`, val);
  };

  const data = useMemo(() => {
    if (!activos || activos.length === 0) return [];
    const count = activos.reduce((acc, a) => {
      let val = a[groupBy];
      if (!val) {
        val = 'Sin dato';
      }
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(count)
      .map(([name, cantidad]) => ({ name, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad); // Ordenar de mayor a menor
  }, [activos, groupBy]);

  const groupLabels = {
    tipo_dispositivo: 'Tipo de Equipo',
    estado: 'Estado',
    marca: 'Marca',
    ubicacion: 'Ubicación'
  };

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Agrupar por:</span>
          <select 
            value={groupBy} 
            onChange={(e) => agruparPor(e.target.value)}
            className="text-sm font-bold text-[#008ce7] bg-blue-50 border border-blue-100 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-[#008ce7]"
          >
            {Object.entries(groupLabels).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => cambiarTipo('pie')}
            className={`p-1.5 rounded-md transition ${type === 'pie' ? 'bg-white shadow text-[#008ce7]' : 'text-gray-500 hover:text-gray-800'}`}
            title="Gráfico Circular"
          >
            <PieChartIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => cambiarTipo('bar')}
            className={`p-1.5 rounded-md transition ${type === 'bar' ? 'bg-white shadow text-[#008ce7]' : 'text-gray-500 hover:text-gray-800'}`}
            title="Gráfico de Barras"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="cantidad"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={3}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={COLORS_ESTADO[entry.name] || COLORS_TIPO[i % COLORS_TIPO.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
              <Legend formatter={(value) => <span className="text-xs text-gray-600 font-medium">{value}</span>} />
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip cursor={{fill: '#f8fafc'}} />
              <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={COLORS_ESTADO[entry.name] || COLORS_TIPO[i % COLORS_TIPO.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
};
