import { useEffect, useState } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';
import { ModalFormulario } from '../components/ModalFormulario';

export const ActivosPage = () => {
  const { activos, cargarActivos, eliminarActivo } = useActivosStore();
  const { isAdmin } = useAuthStore();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [activoSeleccionado, setActivoSeleccionado] = useState(null);

  useEffect(() => {
    cargarActivos();
  }, []);

  const activosFiltrados = activos.filter((a) => {
    const coincideBusqueda =
      a.serie.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.marca.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.modelo.toLowerCase().includes(busqueda.toLowerCase());
    
    const coincideEstado = !filtroEstado || a.estado === filtroEstado;
    
    return coincideBusqueda && coincideEstado;
  });

  const handleEliminar = async (serie) => {
    if (confirm(`¿Eliminar activo ${serie}?`)) {
      await eliminarActivo(serie);
    }
  };

  const handleEditar = (activo) => {
    setActivoSeleccionado(activo);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Activos</h1>
          <p className="text-gray-600">Gestión del inventario de TI</p>
        </div>
        {isAdmin() && (
          <button
            onClick={() => {
              setActivoSeleccionado(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Nuevo Activo
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg p-4 shadow space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="inline w-4 h-4 mr-1" />
              Buscar
            </label>
            <input
              type="text"
              placeholder="Serie, marca, modelo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Todos</option>
              <option value="Asignado">Asignado</option>
              <option value="Disponible">Disponible</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Descartado">Descartado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Serie
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Dispositivo
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Responsable
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Ubicación
                </th>
                {isAdmin() && (
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {activosFiltrados.map((activo) => (
                <tr key={activo.serie} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-700">
                    {activo.serie}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{activo.marca}</p>
                      <p className="text-gray-600 text-xs">{activo.modelo}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {activo.colaborador?.nombre || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <EstadoBadge estado={activo.estado} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {activo.ubicacion}
                  </td>
                  {isAdmin() && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditar(activo)}
                          className="p-1 hover:bg-blue-100 rounded text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminar(activo.serie)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {activosFiltrados.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No hay activos disponibles</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <ModalFormulario
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setActivoSeleccionado(null);
        }}
        activo={activoSeleccionado}
      />
    </div>
  );
};

const EstadoBadge = ({ estado }) => {
  const colores = {
    Asignado: 'bg-green-100 text-green-800',
    Disponible: 'bg-yellow-100 text-yellow-800',
    Mantenimiento: 'bg-red-100 text-red-800',
    Descartado: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colores[estado]}`}>
      {estado}
    </span>
  );
};

import { Package } from 'lucide-react';
