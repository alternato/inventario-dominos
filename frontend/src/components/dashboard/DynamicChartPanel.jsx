import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  PieChart as PieChartIcon, BarChart2, AlignLeft, Gauge,
} from 'lucide-react';
import { COLORS_TIPO, COLORS_ESTADO } from './constants';

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

const EmptyChart = () => (
  <div className="flex items-center justify-center h-48 text-gray-300 text-sm">Sin datos para mostrar</div>
);

export const DynamicChartPanel = ({ id, activos, defaultType, defaultGroupBy, title }) => {
  const navigate = useNavigate();
  const [type,    setType]    = useState(() => localStorage.getItem(`${id}-type`)    || defaultType);
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem(`${id}-groupBy`) || defaultGroupBy);

  const save = (key, val, setter) => { setter(val); localStorage.setItem(`${id}-${key}`, val); };

  const data = useMemo(() => {
    if (!activos?.length) return [];
    const count = activos.reduce((acc, a) => {
      let val = a[groupBy];
      // Si agrupamos por Área, buscamos en el colaborador vinculado
      if (groupBy === 'area' && !val) {
        val = a.colaborador?.area;
      }
      val = val || 'Sin dato';
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
