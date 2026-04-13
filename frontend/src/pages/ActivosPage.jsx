import { useEffect, useState } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { Edit2, Trash2, Plus, Search, Laptop, Smartphone, Wifi, HardDrive, Package, Upload, Undo2 } from 'lucide-react';
import { ModalFormulario } from '../components/ModalFormulario';
import { ModalDevolucion } from '../components/ModalDevolucion';
import ImportDataModal from '../components/ImportDataModal';

import { useLocation } from 'react-router-dom';

export const ActivosPage = () => {
  const { activos, cargarActivos, eliminarActivo } = useActivosStore();
  const { isAdmin } = useAuthStore();
  const location = useLocation();
  const [busqueda, setBusqueda] = useState(location.state?.busqueda || '');
  const [filtroEstado, setFiltroEstado] = useState(location.state?.filtroEstado || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [activoSeleccionado, setActivoSeleccionado] = useState(null);

  useEffect(() => {
    cargarActivos();
  }, []);

  const activosFiltrados = activos.filter((a) => {
    const term = busqueda.toLowerCase();
    const coincideBusqueda =
      a.serie?.toLowerCase().includes(term) ||
      a.marca?.toLowerCase().includes(term) ||
      a.modelo?.toLowerCase().includes(term) ||
      (a.tipo_dispositivo && a.tipo_dispositivo.toLowerCase().includes(term)) ||
      (a.responsable_nombre && a.responsable_nombre.toLowerCase().includes(term)) ||
      (a.ubicacion && a.ubicacion.toLowerCase().includes(term)) ||
      (a.imei && a.imei.toLowerCase().includes(term)) ||
      (a.numero_sim && a.numero_sim.toLowerCase().includes(term)) ||
      (a.imsi && a.imsi.toLowerCase().includes(term));
    
    const coincideEstado = !filtroEstado || a.estado === filtroEstado;
    
    return coincideBusqueda && coincideEstado;
  });

  const handleEliminar = async (serie) => {
    if (confirm(`¿Eliminar activo ${serie}? Esta acción no se puede deshacer.`)) {
      const result = await eliminarActivo(serie);
      if (!result.ok) {
        alert(`Error al eliminar: ${result.error || 'Error desconocido'}`);
      } else {
        // Re-fetch para confirmar que la BD también eliminó el activo
        await cargarActivos();
      }
    }
  };

  const handleEditar = (activo) => {
    setActivoSeleccionado(activo);
    setModalOpen(true);
  };

  const handleDevolucionRapida = (activo) => {
    setActivoSeleccionado(activo);
    setDevolucionModalOpen(true);
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
          <div className="flex gap-2">
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
            >
              <Upload className="w-5 h-5" />
              Importar Datos
            </button>
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
          </div>
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
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center flex-shrink-0">
                        {activo.tipo_dispositivo === 'Laptop' && <Laptop className="w-4 h-4" />}
                        {activo.tipo_dispositivo === 'Smartphone' && <Smartphone className="w-4 h-4" />}
                        {activo.tipo_dispositivo === 'SIM Card' && <Wifi className="w-4 h-4" />}
                        {activo.tipo_dispositivo === 'Desktop' && <HardDrive className="w-4 h-4" />}
                        {!['Laptop', 'Smartphone', 'SIM Card', 'Desktop'].includes(activo.tipo_dispositivo) && <Package className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">{activo.marca}</p>
                            {/* Duplicate Badge */}
                            {(() => {
                              const isDuplicate = activos.some(a => 
                                a.serie !== activo.serie && (
                                  (a.imei && activo.imei && a.imei === activo.imei) ||
                                  (a.numero_telefono && activo.numero_telefono && a.numero_telefono === activo.numero_telefono)
                                )
                              );
                              return isDuplicate ? (
                                <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded flex items-center gap-1" title="Posible duplicado en BD (IMEI o Teléfono)">
                                  ⚠️ Duplicado
                                </span>
                              ) : null;
                            })()}
                        </div>
                        <p className="text-gray-600 text-xs">{activo.modelo}</p>
                        {activo.imei && <p className="text-[10px] text-blue-600 font-mono mt-1">IMEI/ICCID: {activo.imei}</p>}
                        {activo.numero_sim && <p className="text-[10px] text-green-700 font-mono mt-0.5">N° SIM: {activo.numero_sim}</p>}
                        {activo.numero_telefono && <p className="text-[10px] text-green-700 font-bold mt-0.5">Teléfono: {activo.numero_telefono}</p>}
                        {activo.compania && <p className="text-[10px] text-orange-600 font-bold mt-0.5">CIA: {activo.compania}</p>}
                        {activo.imsi && <p className="text-[10px] text-purple-600 font-mono mt-0.5">IMSI: {activo.imsi}</p>}
                      </div>
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
                        {activo.rut_responsable && (
                          <button
                            onClick={() => handleDevolucionRapida(activo)}
                            className="p-1 hover:bg-orange-100 rounded text-orange-500"
                            title="Desasignar / Devolver Rápido"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditar(activo)}
                          className="p-1 hover:bg-blue-100 rounded text-blue-600"
                          title="Editar Ficha"
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

      {/* Modal Edición Regular */}
      <ModalFormulario
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setActivoSeleccionado(null);
        }}
        activo={activoSeleccionado}
      />
      {/* Modal Devolución Expresa */}
      <ModalDevolucion
        isOpen={devolucionModalOpen}
        onClose={() => {
          setDevolucionModalOpen(false);
          setActivoSeleccionado(null);
        }}
        activo={activoSeleccionado}
      />
      {/* Modal Importar Datos */}
      <ImportDataModal 
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => {
          cargarActivos();
        }}
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


