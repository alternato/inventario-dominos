import { useEffect, useState, useMemo } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { kpisAPI } from '../api';
import { Settings2, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KpiCard } from '../components/dashboard/KpiCard';
import { DuplicadosAlert } from '../components/dashboard/DuplicadosAlert';
import { TypeStateMatrix } from '../components/dashboard/TypeStateMatrix';
import { DynamicChartPanel } from '../components/dashboard/DynamicChartPanel';
import { ALL_WIDGETS, COLORS_TIPO } from '../components/dashboard/constants';

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
