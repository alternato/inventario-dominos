import {
  Edit2, Trash2, Undo2, ChevronRight,
  Package, AlertTriangle,
} from 'lucide-react';
import { getTipoIcon, getTipoColor } from './constants';
import { EstadoBadge } from './EstadoBadge';

export const ActivosTabla = ({
  activos,
  duplicadosSeries,
  panelActivo,
  onSelectRow,
  isAdmin,
  busqueda,
  filtroEstado,
  onLimpiarFiltros,
  onEditar,
  onDevolucion,
  onEliminar,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dispositivo</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Serie</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Responsable</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ubicación</th>
            {isAdmin && (
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
            )}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {activos.map((activo) => {
            const isSelected = panelActivo?.serie === activo.serie;
            const dup = duplicadosSeries.has(activo.serie);
            return (
              <tr
                key={activo.serie}
                onClick={() => onSelectRow(isSelected ? null : activo)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50/70 border-l-2 border-l-primary'
                    : 'hover:bg-gray-50/80'
                }`}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTipoColor(activo.tipo_dispositivo)}`}>
                      {getTipoIcon(activo.tipo_dispositivo)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm leading-tight flex items-center gap-1.5">
                        {activo.marca}
                        {dup && (
                          <span title="Posible duplicado (IMEI o teléfono repetido)" className="text-amber-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </p>
                      <p className="text-gray-400 text-xs">{activo.modelo}</p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {activo.serie}
                  </span>
                </td>

                <td className="px-5 py-3.5 text-sm text-gray-700">
                  {activo.colaborador?.nombre
                    ? <span>{activo.colaborador.nombre}</span>
                    : <span className="text-gray-300 text-xs italic">— Sin asignar</span>}
                </td>

                <td className="px-5 py-3.5">
                  <EstadoBadge estado={activo.estado} />
                </td>

                <td className="px-5 py-3.5 text-sm text-gray-600 max-w-[160px] truncate">
                  {activo.ubicacion || <span className="text-gray-300 text-xs italic">—</span>}
                </td>

                {isAdmin && (
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      {activo.rut_responsable && (
                        <button
                          onClick={(e) => onDevolucion(activo, e)}
                          className="p-1.5 hover:bg-orange-100 rounded-lg text-orange-400 transition"
                          title="Desasignar / Devolver"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => onEditar(activo, e)}
                        className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-500 transition"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEliminar(activo.serie); }}
                        className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}

                <td className="pr-3">
                  <ChevronRight
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isSelected ? 'rotate-90 text-primary' : 'text-gray-300'
                    }`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {activos.length === 0 && (
      <div className="text-center py-16 text-gray-400">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No hay activos que coincidan con la búsqueda</p>
        {(busqueda || filtroEstado) && (
          <button
            onClick={onLimpiarFiltros}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    )}
  </div>
);
