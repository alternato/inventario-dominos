import { useEffect, useState, useMemo } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { kpisAPI } from '../api';
import {
  Package, Users, Activity, TrendingUp,
  Settings2, X, Check, BarChart2,
  PieChart as PieChartIcon, AlignLeft, Gauge, LayoutGrid,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const COLORS_TIPO  = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#6B7280','#0EA5E9','#F97316'];
const COLORS_ESTADO = { Asignado: '#10B981', Disponible: '#F59E0B', Mantenimiento: '#EF4444', Descartado: '#6B7280' };

const ALL_WIDGETS = [
  { id: 'kpi-total',        label: 'KPI Total Activos' },
  { id: 'kpi-asignados',    label: 'KPI Asignados' },
  { id: 'kpi-disponibles',  label: 'KPI Disponibles' },
  { id: 'kpi-mantenimiento',label: 'KPI Mantenimiento' },
  { id: 'chart-tipo',       label: 'Gráfico Tipo de Equipo' },
  { id: 'chart-estado',     label: 'Gráfico por Estado' },
  { id: 'chart-area',       label: 'Gráfico por Área' },
  { id: 'chart-marca',      label: 'Gráfico por Marca' },
  { id: 'matrix-tipo',      label: 'Tabla Tipo × Estado' },
  { id: 'list-colab',       label: 'Top Colaboradores' },
  { id: 'list-tipo',        label: 'Resumen por Tipo' },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const { activos, cargarActivos } = useActivosStore();
  const { usuario } = useAuthStore();
  const [kpis, setKpis] = useState(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  const defaultWidgets = ALL_WIDGETS.map(w => w.id);
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

  const show = (id) => visibleWidgets.includes(id);

  useEffect(() => {
    cargarActivos();
    kpisAPI.obtener()
      .then(r => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoadingKpis(false));
  }, []);

  const stats = {
    total:         activos.length,
    asignados:     activos.filter(a => a.estado === 'Asignado').length,
    disponibles:   activos.filter(a => a.estado === 'Disponible').length,
    mantenimiento: activos.filter(a => a.estado === 'Mantenimiento').length,
  };

  const porTipo = kpis?.porTipo ?? Object.entries(
    activos.reduce((acc, a) => {
      acc[a.tipo_dispositivo] = (acc[a.tipo_dispositivo] || 0) + 1;
      return acc;
    }, {})
  ).map(([tipo_dispositivo, cantidad]) => ({ tipo_dispositivo, cantidad }));

  const duplicadosLocales = useMemo(() => {
    if (kpis?.duplicados) return kpis.duplicados;

    // Solo chequeamos activos NO descartados — un equipo descartado libera su SIM/IMEI
    const activos_activos = activos.filter(a => a.estado !== 'Descartado');

    const imeisMap = {}, simsMap = {}, telefonosMap = {};
    activos_activos.forEach(a => {
      const imei = String(a.imei ?? '').trim();
      const sim  = String(a.numero_sim ?? '').trim();
      const tel  = String(a.numero_telefono ?? '').trim();

      if (imei) imeisMap[imei] = (imeisMap[imei] || 0) + 1;
      if (sim)  simsMap[sim]   = (simsMap[sim]   || 0) + 1;
      if (tel)  telefonosMap[tel] = (telefonosMap[tel] || 0) + 1;
    });

    return {
      imeis:    Object.entries(imeisMap).filter(([,c]) => c > 1).map(([imei, cantidad]) => ({ imei, cantidad })),
      sims:     Object.entries(simsMap).filter(([,c]) => c > 1).map(([numero_sim, cantidad]) => ({ numero_sim, cantidad })),
      telefonos:Object.entries(telefonosMap).filter(([,c]) => c > 1).map(([numero_telefono, cantidad]) => ({ numero_telefono, cantidad })),
    };
  }, [activos, kpis]);

  const topColaboradores = kpis?.topColaboradores ?? [];
  const pct = stats.total > 0 ? Math.round((stats.asignados / stats.total) * 100) : 0;

  return (
    <div className="space-y-6 relative">

      {/* ── Botón Configuración ── */}
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
              <h3 className="text-sm font-bold">Ocultar / Mostrar Paneles</h3>
              <button onClick={() => setShowConfig(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm font-medium">
              {ALL_WIDGETS.map(w => (
                <label key={w.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      show(w.id) ? 'bg-[#008ce7] border-[#008ce7]' : 'border-gray-300'
                    }`}
                    onClick={() => toggleWidget(w.id)}
                  >
                    {show(w.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-gray-600">{w.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Jumbotron ── */}
      <div className="bg-[#0070bc] text-white rounded-2xl p-6 md:p-8 2xl:p-10 relative overflow-hidden shadow-sm transition-all">
        <div className="absolute -right-10 -top-20 opacity-10 pointer-events-none">
          <svg width="300" height="300" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          </svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-sm md:text-base font-semibold text-blue-100 mb-1">
              Hola, <span className="font-bold text-white">{usuario?.nombre || 'Administrador'} 👋</span>
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">Inventario Activo</h1>
            <p className="text-sm font-medium text-blue-100 max-w-md">
              Gestiona y monitorea todos los activos tecnológicos de la empresa desde un solo panel adaptable.
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-5xl md:text-6xl font-black text-white leading-none">
              {stats.asignados} <span className="text-2xl font-bold text-blue-200">/ {stats.total}</span>
            </p>
            <p className="text-sm font-bold text-blue-100 mt-2">
              EQUIPOS ASIGNADOS ({pct}%)
            </p>
          </div>
        </div>
      </div>

      {/* ── Alertas duplicados ── */}
      {duplicadosLocales && (duplicadosLocales.imeis?.length > 0 || duplicadosLocales.sims?.length > 0 || duplicadosLocales.telefonos?.length > 0) && (
        <DuplicadosAlert duplicados={duplicadosLocales} navigate={navigate} />
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 2xl:gap-6">
        {show('kpi-total')         && <KpiCard title="Total Activos"  value={stats.total}         color="blue"   sub={`${pct}% asignados`}      onClick={() => navigate('/activos')} />}
        {show('kpi-asignados')     && <KpiCard title="Asignados"      value={stats.asignados}     color="green"  sub="En uso"                   onClick={() => navigate('/activos', { state: { filtroEstado: 'Asignado' } })} />}
        {show('kpi-disponibles')   && <KpiCard title="Disponibles"    value={stats.disponibles}   color="yellow" sub="Listos para asignar"      onClick={() => navigate('/activos', { state: { filtroEstado: 'Disponible' } })} />}
        {show('kpi-mantenimiento') && <KpiCard title="Mantenimiento"  value={stats.mantenimiento} color="red"    sub="En revisión"              onClick={() => navigate('/activos', { state: { filtroEstado: 'Mantenimiento' } })} />}
      </div>

      {/* ── Contenedor de Gráficos Adaptable ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 2xl:gap-6">
        {show('chart-tipo')   && <DynamicChartPanel id="chart1" activos={activos} defaultType="pie"        defaultGroupBy="tipo_dispositivo" title="Distribución de Equipos" />}
        {show('chart-estado') && <DynamicChartPanel id="chart2" activos={activos} defaultType="bar"        defaultGroupBy="estado"           title="Equipos por Estado" />}
        {show('chart-area')  && <DynamicChartPanel id="chart3" activos={activos} defaultType="horizontal" defaultGroupBy="area"             title="Distribución por Área" />}
        {show('chart-marca') && <DynamicChartPanel id="chart4" activos={activos} defaultType="radial"     defaultGroupBy="marca"            title="Equipos por Marca" />}
      </div>

      {/* ── Tabla Tipo × Estado ── */}
      {show('matrix-tipo') && <TypeStateMatrix activos={activos} navigate={navigate} />}

      {/* ── Fila inferior: Top Colab + Resumen Tipo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {show('list-colab') && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">Top Colaboradores con más Equipos</h2>
            {topColaboradores.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos suficientes</p>
            ) : (
              <div className="space-y-3">
                {topColaboradores.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    onClick={() => navigate('/activos', { state: { busqueda: c.colaborador } })}
                  >
                    <span className="w-6 h-6 rounded-full bg-[#008ce7] text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.colaborador}</p>
                      <p className="text-xs text-gray-500">{c.area}</p>
                    </div>
                    <span className="text-sm font-bold text-[#008ce7]">{c.total_equipos}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {show('list-tipo') && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">Inventario por Tipo</h2>
            <div className="space-y-3">
              {porTipo.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin activos registrados</p>
              ) : porTipo.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => navigate('/activos', { state: { busqueda: t.tipo_dispositivo } })}
                >
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-700">{t.tipo_dispositivo}</span>
                      <span className="text-sm font-bold" style={{ color: COLORS_TIPO[i % COLORS_TIPO.length] }}>{t.cantidad}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${(t.cantidad / stats.total) * 100}%`, backgroundColor: COLORS_TIPO[i % COLORS_TIPO.length] }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, color, sub, onClick }) => {
  const styles = {
    blue:   { b: 'border-[#0066CC]', t: 'text-[#0066CC]', txt: 'text-gray-500' },
    green:  { b: 'border-[#10B981]', t: 'text-[#10B981]', txt: 'text-green-600' },
    yellow: { b: 'border-[#F59E0B]', t: 'text-[#F59E0B]', txt: 'text-yellow-600' },
    red:    { b: 'border-[#E31837]', t: 'text-[#E31837]', txt: 'text-red-600' },
  };
  const s = styles[color] || styles.blue;
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 pl-6 border-l-[6px] ${s.b} hover:shadow-md transition relative overflow-hidden flex flex-col justify-between min-h-[140px] ${onClick ? 'cursor-pointer hover:bg-gray-50 transform hover:-translate-y-1' : ''}`}
    >
      <div>
        <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-1">{title}</p>
        <p className={`text-4xl font-extrabold ${s.t}`}>{value}</p>
      </div>
      {sub && <p className={`text-sm font-semibold mt-4 ${s.txt}`}>{sub} ☝️</p>}
    </div>
  );
};

// ─── Alerta interactiva de duplicados ─────────────────────────────────────────
const DuplicadosAlert = ({ duplicados, navigate }) => {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState({ imeis: false, sims: false, telefonos: false });

  if (dismissed) return null;

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const total =
    (duplicados.imeis?.length || 0) +
    (duplicados.sims?.length || 0) +
    (duplicados.telefonos?.length || 0);

  const Section = ({ sectionKey, label, items, valueKey, searchLabel }) => {
    if (!items?.length) return null;
    const open = expanded[sectionKey];
    return (
      <div className="border-t border-red-100 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
        <button
          onClick={() => toggle(sectionKey)}
          className="flex items-center justify-between w-full text-left group"
        >
          <span className="text-sm font-semibold text-red-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black">
              {items.length}
            </span>
            {label} {items.length === 1 ? 'duplicado' : 'duplicados'}
          </span>
          <span className={`text-red-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {open && (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item, i) => {
              const val = item[valueKey];
              return (
                <button
                  key={i}
                  onClick={() => navigate('/activos', { state: { busqueda: val } })}
                  title={`Ver los ${item.cantidad} activos con ${searchLabel}: ${val}`}
                  className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-400 transition-all group/chip"
                >
                  <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>{val}</span>
                  <span className="text-red-400 group-hover/chip:text-red-600 font-normal">×{item.cantidad}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-100 border-b border-red-200">
        <div className="flex items-center gap-2.5">
          <svg className="h-4 w-4 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-bold text-red-900">
            Alerta de Integridad — {total} tipo{total > 1 ? 's' : ''} de duplicado{total > 1 ? 's' : ''} detectado{total > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-red-500 font-medium">· Haz click en un valor para ver los activos</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-400 hover:text-red-700 transition ml-2 flex-shrink-0"
          title="Descartar alerta (esta sesión)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Secciones expandibles */}
      <div className="px-4 py-3 space-y-0">
        <Section
          sectionKey="imeis"
          label="IMEI"
          items={duplicados.imeis}
          valueKey="imei"
          searchLabel="IMEI"
        />
        <Section
          sectionKey="sims"
          label="SIM (ICCID)"
          items={duplicados.sims}
          valueKey="numero_sim"
          searchLabel="SIM"
        />
        <Section
          sectionKey="telefonos"
          label="Teléfono"
          items={duplicados.telefonos}
          valueKey="numero_telefono"
          searchLabel="teléfono"
        />
      </div>
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyChart = () => (
  <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Sin datos para mostrar</div>
);

// ─── Tabla Tipo × Estado ──────────────────────────────────────────────────────
const TypeStateMatrix = ({ activos, navigate }) => {
  const ESTADOS = ['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'];
  const EC = {
    Asignado:      { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
    Disponible:    { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
    Mantenimiento: { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
    Descartado:    { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  };

  const matrix = useMemo(() => {
    const tipos = [...new Set(activos.map(a => a.tipo_dispositivo).filter(Boolean))].sort();
    return tipos.map(tipo => {
      const row = { tipo, total: 0 };
      ESTADOS.forEach(estado => {
        const c = activos.filter(a => a.tipo_dispositivo === tipo && a.estado === estado).length;
        row[estado] = c;
        row.total += c;
      });
      return row;
    }).sort((a, b) => b.total - a.total);
  }, [activos]);

  return (
    <div className="bg-white rounded-xl shadow p-6 overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-[#008ce7]" />
          <h2 className="text-base font-bold text-gray-800">Distribución Tipo × Estado</h2>
        </div>
        <div className="flex items-center gap-4">
          {ESTADOS.map(e => (
            <div key={e} className="hidden sm:flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${EC[e].dot}`} />
              <span className="text-xs text-gray-500">{e}</span>
            </div>
          ))}
        </div>
      </div>
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b-2 border-gray-100">
            <th className="text-left py-2 pr-4 text-xs text-gray-400 font-semibold uppercase tracking-widest">Tipo de Equipo</th>
            {ESTADOS.map(e => (
              <th key={e} className="text-center py-2 px-2 text-xs text-gray-400 font-semibold uppercase tracking-widest">{e}</th>
            ))}
            <th className="text-center py-2 pl-4 text-xs text-gray-400 font-semibold uppercase tracking-widest">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {matrix.length === 0
            ? <tr><td colSpan={6} className="text-center py-10 text-gray-300">Sin datos registrados</td></tr>
            : matrix.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors group">
                <td className="py-3 pr-4 font-semibold text-gray-800 whitespace-nowrap">{row.tipo}</td>
                {ESTADOS.map(e => {
                  const count = row[e] || 0;
                  const c = EC[e];
                  return (
                    <td key={e} className="text-center py-3 px-2">
                      {count > 0 ? (
                        <button
                          onClick={() => navigate('/activos', { state: { filtroEstado: e, busqueda: row.tipo } })}
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.text} hover:opacity-75 transition`}
                        >
                          {count}
                        </button>
                      ) : (
                        <span className="text-gray-200 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center py-3 pl-4 font-extrabold text-gray-900">{row.total}</td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Dynamic Chart Panel ──────────────────────────────────────────────────────
const CHART_TYPES = [
  { key: 'pie',        Icon: PieChartIcon, title: 'Circular (Donut)' },
  { key: 'bar',        Icon: BarChart2,    title: 'Barras Verticales' },
  { key: 'horizontal', Icon: AlignLeft,    title: 'Barras Horizontales' },
  { key: 'radial',     Icon: Gauge,        title: 'Barras Radiales' },
];

const GROUP_LABELS = {
  tipo_dispositivo: 'Tipo de Equipo',
  estado:           'Estado',
  marca:            'Marca',
  ubicacion:        'Ubicación',
  area:             'Área',
};

const DynamicChartPanel = ({ id, activos, defaultType, defaultGroupBy, title }) => {
  const navigate = useNavigate();
  const [type,    setType]    = useState(() => localStorage.getItem(`${id}-type`)    || defaultType);
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem(`${id}-groupBy`) || defaultGroupBy);

  const save = (key, val, setter) => { setter(val); localStorage.setItem(`${id}-${key}`, val); };

  const data = useMemo(() => {
    if (!activos?.length) return [];
    const count = activos.reduce((acc, a) => {
      const val = a[groupBy] || 'Sin dato';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
    const total = Object.values(count).reduce((s, c) => s + c, 0);
    return Object.entries(count)
      .map(([name, cantidad], i) => ({
        name, cantidad,
        fill: COLORS_ESTADO[name] || COLORS_TIPO[i % COLORS_TIPO.length],
        pct: total > 0 ? Math.round((cantidad / total) * 100) : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [activos, groupBy]);

  const goto = (name) => {
    if (groupBy === 'estado') navigate('/activos', { state: { filtroEstado: name } });
    else                      navigate('/activos', { state: { busqueda: name } });
  };

  return (
    <div className="bg-white rounded-xl shadow p-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {title && <span className="text-sm font-bold text-gray-700 mr-1">{title}</span>}
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">·</span>
          <select
            value={groupBy}
            onChange={e => save('groupBy', e.target.value, setGroupBy)}
            className="text-xs font-bold text-[#008ce7] bg-blue-50 border border-blue-100 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-[#008ce7]"
          >
            {Object.entries(GROUP_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center bg-gray-100 p-1 rounded-lg gap-0.5">
          {CHART_TYPES.map(({ key, Icon, title: t }) => (
            <button
              key={key}
              onClick={() => save('type', key, setType)}
              className={`p-1.5 rounded-md transition-all ${type === key ? 'bg-white shadow text-[#008ce7]' : 'text-gray-400 hover:text-gray-700'}`}
              title={t}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {data.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={240}>
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={data} dataKey="cantidad" nameKey="name"
                cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3}
                onClick={e => goto(e.name)} className="cursor-pointer"
              >
                {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} equipos`, n]} />
              <Legend formatter={v => <span className="text-xs text-gray-600 font-medium">{v}</span>} />
            </PieChart>

          ) : type === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [`${v} equipos`]} />
              <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} onClick={e => goto(e.name)} className="cursor-pointer">
                {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>

          ) : type === 'horizontal' ? (
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v) => [`${v} equipos`]} />
              <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} onClick={e => goto(e.name)} className="cursor-pointer">
                {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>

          ) : (
            // Radial bars
            <RadialBarChart
              cx="50%" cy="55%"
              innerRadius="15%"
              outerRadius="85%"
              data={[...data].reverse()}
              startAngle={180} endAngle={0}
            >
              <RadialBar
                dataKey="cantidad"
                label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 'bold' }}
                onClick={e => goto(e.name)}
                className="cursor-pointer"
              />
              <Legend
                iconSize={10}
                layout="horizontal"
                verticalAlign="bottom"
                formatter={v => <span className="text-xs text-gray-600 font-medium">{v}</span>}
              />
              <Tooltip formatter={(v, n) => [`${v} equipos`, n]} />
            </RadialBarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
};
