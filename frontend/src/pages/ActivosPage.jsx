import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { ModalFormulario } from '../components/ModalFormulario';
import { ModalDevolucion } from '../components/ModalDevolucion';
import { ModalAsignacion } from '../components/ModalAsignacion';
import ImportDataModal from '../components/ImportDataModal';
import { DetallePanelActivo } from '../components/activos/DetallePanelActivo';
import { ActivosHeader } from '../components/activos/ActivosHeader';
import { ActivosFiltros } from '../components/activos/ActivosFiltros';
import { ActivosTabla } from '../components/activos/ActivosTabla';

export const ActivosPage = () => {
  const { activos, cargarActivos, eliminarActivo } = useActivosStore();
  const { isAdmin } = useAuthStore();
  const location = useLocation();

  const [busqueda,            setBusqueda]            = useState(location.state?.busqueda    || '');
  const [filtroEstado,        setFiltroEstado]        = useState(location.state?.filtroEstado || '');
  const [modalOpen,           setModalOpen]           = useState(false);
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);
  const [asignacionModalOpen, setAsignacionModalOpen] = useState(false);
  const [importModalOpen,     setImportModalOpen]     = useState(false);
  const [activoSeleccionado,  setActivoSeleccionado]  = useState(null);
  const [panelActivo,         setPanelActivo]         = useState(null);
  const [toast,               setToast]               = useState(null);

  const showToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => { cargarActivos(); }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setPanelActivo(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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

  const duplicadosSeries = useMemo(() => {
    const seen = new Map();
    const dupes = new Set();
    activos.forEach(a => {
      for (const key of [a.imei && `imei:${a.imei}`, a.numero_telefono && `tel:${a.numero_telefono}`]) {
        if (!key) continue;
        if (seen.has(key)) { dupes.add(a.serie); dupes.add(seen.get(key)); }
        else seen.set(key, a.serie);
      }
    });
    return dupes;
  }, [activos]);

  const handleEliminar = async (serie) => {
    if (confirm(`¿Eliminar activo ${serie}? Esta acción no se puede deshacer.`)) {
      const result = await eliminarActivo(serie);
      if (!result.ok) {
        alert(`Error al eliminar: ${result.error || 'Error desconocido'}`);
      } else {
        if (panelActivo?.serie === serie) setPanelActivo(null);
        await cargarActivos();
      }
    }
  };

  const handleEditar = (activo, e) => {
    e?.stopPropagation();
    setActivoSeleccionado(activo);
    setModalOpen(true);
  };

  const handleDevolucionRapida = (activo, e) => {
    e?.stopPropagation();
    setActivoSeleccionado(activo);
    setDevolucionModalOpen(true);
  };

  const handleAsignar = (activo, e) => {
    e?.stopPropagation();
    setActivoSeleccionado(activo);
    setAsignacionModalOpen(true);
  };

  return (
    <div className="flex gap-0" style={{ minHeight: 0 }}>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          toast.tipo === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Columna principal */}
      <div className="flex-1 flex flex-col gap-5 transition-all duration-300 2xl:px-4" style={{ minWidth: 0 }}>
        <ActivosHeader
          total={activos.length}
          filtrados={activosFiltrados.length}
          filtroEstado={filtroEstado}
          isAdmin={isAdmin()}
          onNuevo={() => { setActivoSeleccionado(null); setModalOpen(true); }}
          onImportar={() => setImportModalOpen(true)}
        />
        <ActivosFiltros
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          filtroEstado={filtroEstado}
          onFiltroEstado={setFiltroEstado}
        />
        <ActivosTabla
          activos={activosFiltrados}
          duplicadosSeries={duplicadosSeries}
          panelActivo={panelActivo}
          onSelectRow={setPanelActivo}
          isAdmin={isAdmin()}
          busqueda={busqueda}
          filtroEstado={filtroEstado}
          onLimpiarFiltros={() => { setBusqueda(''); setFiltroEstado(''); }}
          onEditar={handleEditar}
          onDevolucion={handleDevolucionRapida}
          onEliminar={handleEliminar}
        />
      </div>

      {/* Panel lateral de detalle */}
      <div
        className={`flex-shrink-0 sticky top-0 h-fit max-h-[calc(100vh-120px)] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl transition-all duration-300 ease-in-out ${
          panelActivo ? 'w-80 2xl:w-[450px] opacity-100 ml-6' : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        {panelActivo && (
          <DetallePanelActivo
            activo={panelActivo}
            isAdmin={isAdmin()}
            onEditar={(a) => handleEditar(a)}
            onDevolucion={(a) => handleDevolucionRapida(a)}
            onAsignar={(a) => handleAsignar(a)}
            onCerrar={() => setPanelActivo(null)}
            isDuplicate={duplicadosSeries.has(panelActivo.serie)}
          />
        )}
      </div>

      {/* Modales */}
      <ModalFormulario
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setActivoSeleccionado(null); }}
        activo={activoSeleccionado}
      />
      <ModalDevolucion
        isOpen={devolucionModalOpen}
        onClose={() => { setDevolucionModalOpen(false); setActivoSeleccionado(null); }}
        activo={activoSeleccionado}
        onSuccess={(msg) => showToast(msg)}
      />
      <ModalAsignacion
        isOpen={asignacionModalOpen}
        onClose={() => { setAsignacionModalOpen(false); setActivoSeleccionado(null); }}
        activo={activoSeleccionado}
        onSuccess={(msg) => showToast(msg)}
      />
      <ImportDataModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => cargarActivos()}
      />
    </div>
  );
};
