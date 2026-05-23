import { Search, X } from 'lucide-react';
import { ESTADOS, ESTADO_STYLE } from './constants';

export const ActivosFiltros = ({ busqueda, onBusqueda, filtroEstado, onFiltroEstado }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
    <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <input
        type="text"
        placeholder="Buscar por serie, marca, modelo, responsable..."
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        className="bg-transparent flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
      />
      {busqueda && (
        <button onClick={() => onBusqueda('')} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    <div className="flex gap-1.5 flex-wrap">
      <button
        onClick={() => onFiltroEstado('')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
          filtroEstado === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Todos
      </button>
      {ESTADOS.map((e) => (
        <button
          key={e}
          onClick={() => onFiltroEstado(filtroEstado === e ? '' : e)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            filtroEstado === e
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_STYLE[e]?.dot}`} />
          {e}
        </button>
      ))}
    </div>
  </div>
);
