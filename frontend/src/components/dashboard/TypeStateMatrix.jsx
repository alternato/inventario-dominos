import { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';

export const TypeStateMatrix = ({ activos, navigate }) => {
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
