import { useState, useEffect } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import {
  Users, Plus, Search, Edit2, Trash2, Package,
  Phone, Mail, Building2, ChevronRight, X
} from 'lucide-react';
import { ModalColaborador } from '../components/ModalColaborador';

export const ColaboradoresPage = () => {
  const { colaboradores, cargarColaboradores, cargarActivos, activos, eliminarColaborador } = useActivosStore();
  const { isAdmin } = useAuthStore();
  const [busqueda, setBusqueda] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [vistaDetalle, setVistaDetalle] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    cargarColaboradores();
    cargarActivos();
  }, []);

  const showToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const filtrados = colaboradores.filter((c) => {
    const q = busqueda.toLowerCase();
    const coincide =
      c.nombre?.toLowerCase().includes(q) ||
      c.rut?.toLowerCase().includes(q) ||
      c.correo?.toLowerCase().includes(q) ||
      c.cargo?.toLowerCase().includes(q) ||
      c.telefono?.toLowerCase().includes(q);
    const coincideArea = !filtroArea || c.area === filtroArea;
    return coincide && coincideArea;
  });

  const activosDeColaborador = (rut) =>
    activos.filter((a) => a.rut_responsable === rut && a.estado === 'Asignado');

  const handleEliminar = async (rut, nombre) => {
    if (!confirm(`¿Eliminar a ${nombre}? Sus activos quedarán sin asignar.`)) return;
    const r = await eliminarColaborador(rut);
    if (r.ok) showToast('Colaborador eliminado');
    else showToast(r.error, 'error');
    if (vistaDetalle?.rut === rut) setVistaDetalle(null);
  };

  const handleEditar = (col) => { setSeleccionado(col); setModalOpen(true); };

  const areas = ['Operaciones', 'Administración', 'Logística', 'TI', 'RRHH', 'Otro'];
  const coloresArea = {
    'TI': 'bg-blue-100 text-blue-800',
    'Operaciones': 'bg-green-100 text-green-800',
    'Administración': 'bg-purple-100 text-purple-800',
    'Logística': 'bg-orange-100 text-orange-800',
    'RRHH': 'bg-pink-100 text-pink-800',
    'Otro': 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${toast.tipo === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Colaboradores</h1>
          <p className="text-gray-500 mt-1">{colaboradores.length} colaboradores registrados</p>
        </div>
        {isAdmin() && (
          <button
            onClick={() => { setSeleccionado(null); setModalOpen(true); }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" /> Nuevo Colaborador
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg p-4 shadow flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT, correo, cargo, teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
          />
        </div>
        <select
          value={filtroArea}
          onChange={(e) => setFiltroArea(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
        >
          <option value="">Todas las áreas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Contenido principal: lista + detalle */}
      <div className="flex gap-4">
        {/* Tabla */}
        <div className={`bg-white rounded-lg shadow overflow-hidden ${vistaDetalle ? 'flex-1' : 'w-full'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Colaborador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Área / Cargo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contacto</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Equipos</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((col) => {
                  const nEquipos = activosDeColaborador(col.rut).length;
                  const isSelected = vistaDetalle?.rut === col.rut;
                  return (
                    <tr
                      key={col.rut}
                      onClick={() => setVistaDetalle(isSelected ? null : col)}
                      className={`hover:bg-blue-50 cursor-pointer transition ${isSelected ? 'bg-blue-50 border-l-4 border-primary' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {col.nombre?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{col.nombre}</p>
                            <p className="text-xs text-gray-500 font-mono">{col.rut}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${coloresArea[col.area] || coloresArea['Otro']}`}>
                          {col.area}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{col.cargo || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 space-y-0.5">
                        {col.correo && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{col.correo}</p>}
                        {col.telefono && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{col.telefono}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${nEquipos > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                          <Package className="w-3 h-3" />{nEquipos}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setVistaDetalle(isSelected ? null : col)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600" title="Ver detalle">
                            <ChevronRight className={`w-4 h-4 transition ${isSelected ? 'rotate-90' : ''}`} />
                          </button>
                          {isAdmin() && (
                            <>
                              <button onClick={() => handleEditar(col)} className="p-1.5 hover:bg-yellow-100 rounded text-yellow-600" title="Editar">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleEliminar(col.rut, col.nombre)} className="p-1.5 hover:bg-red-100 rounded text-red-600" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtrados.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No se encontraron colaboradores</p>
              <p className="text-sm">Intenta con otro término de búsqueda</p>
            </div>
          )}
        </div>

        {/* Panel de detalle */}
        {vistaDetalle && (
          <div className="w-80 bg-white rounded-lg shadow p-5 space-y-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Detalle</h3>
              <button onClick={() => setVistaDetalle(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Avatar y datos */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                {vistaDetalle.nombre?.charAt(0).toUpperCase()}
              </div>
              <h4 className="font-semibold text-gray-800">{vistaDetalle.nombre}</h4>
              <p className="text-sm text-gray-500 font-mono">{vistaDetalle.rut}</p>
              <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${coloresArea[vistaDetalle.area] || coloresArea['Otro']}`}>
                {vistaDetalle.area}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              {vistaDetalle.cargo && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {vistaDetalle.cargo}
                </div>
              )}
              {vistaDetalle.correo && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {vistaDetalle.correo}
                </div>
              )}
              {vistaDetalle.telefono && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {vistaDetalle.telefono}
                </div>
              )}
            </div>

            {/* Equipos asignados */}
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Equipos Asignados
              </h5>
              {activosDeColaborador(vistaDetalle.rut).length === 0 ? (
                <p className="text-sm text-gray-400 italic">Sin equipos asignados</p>
              ) : (
                <div className="space-y-2">
                  {activosDeColaborador(vistaDetalle.rut).map((a) => (
                    <div key={a.serie} className="bg-gray-50 rounded-lg p-2.5 text-xs">
                      <p className="font-semibold text-gray-800">{a.marca} {a.modelo}</p>
                      <p className="text-gray-500">{a.tipo_dispositivo} · {a.serie}</p>
                      {a.imei && <p className="text-gray-400">IMEI: {a.imei}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ModalColaborador
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSeleccionado(null); }}
        colaborador={seleccionado}
        onSuccess={(msg) => showToast(msg)}
      />
    </div>
  );
};
