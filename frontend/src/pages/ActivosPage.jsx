import { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { ModalFormulario } from '../components/ModalFormulario';
import { ModalDevolucion } from '../components/ModalDevolucion';
import { ModalAsignacion } from '../components/ModalAsignacion';
import ImportDataModal from '../components/ImportDataModal';
import { Pagination } from '../components/Pagination';
import { DetallePanelActivo } from '../components/activos/DetallePanelActivo';
import { ActivosHeader } from '../components/activos/ActivosHeader';
import { ActivosFiltros } from '../components/activos/ActivosFiltros';
import { ActivosTabla } from '../components/activos/ActivosTabla';

export const ActivosPage = () => {
  const { activos, activosPagination, cargarActivos, eliminarActivo } = useActivosStore();
  const { isAdmin } = useAuthStore();
  const location = useLocation();

  const [busqueda,            setBusqueda]            = useState(location.state?.busqueda    || '');
  const [filtroEstado,        setFiltroEstado]        = useState(location.state?.filtroEstado || '');
  const [page,                setPage]                = useState(1);
  const [pageSize,            setPageSize]            = useState(50);
  const [modalOpen,           setModalOpen]           = useState(false);
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);
  const [asignacionModalOpen, setAsignacionModalOpen] = useState(false);
  const [importModalOpen,     setImportModalOpen]     = useState(false);
  const [activoSeleccionado,  setActivoSeleccionado]  = useState(null);
  const [panelActivo,         setPanelActivo]         = useState(null);
  const [toast,               setToast]               = useState(null);

  // La búsqueda se estabiliza 300 ms antes de disparar una consulta al servidor.
  const busquedaDebounced = useDebouncedValue(busqueda, 300);

  const showToast = (msg, tipo = 'success') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  // Params de consulta al servidor: omite q/estado vacíos para no enviar filtros nulos.
  const buildParams = useCallback(() => ({
    page,
    pageSize,
    q: busquedaDebounced || undefined,
    estado: filtroEstado || undefined,
  }), [page, pageSize, busquedaDebounced, filtroEstado]);

  // Al cambiar el término de búsqueda o el estado, volver a la primera página.
  useEffect(() => {
    setPage(1);
  }, [busquedaDebounced, filtroEstado]);

  // Paginación/filtrado en servidor: recarga ante cualquier cambio de page,
  // pageSize, búsqueda (debounced) o estado.
  useEffect(() => {
    cargarActivos({
      params: {
        page,
        pageSize,
        q: busquedaDebounced || undefined,
        estado: filtroEstado || undefined,
      },
    });
  }, [page, pageSize, busquedaDebounced, filtroEstado, cargarActivos]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setPanelActivo(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // NOTA: con paginación en servidor este cálculo solo ve la página actual,
  // por lo que el aviso de duplicados es "best-effort" sobre las filas cargadas
  // (una pista visual). No se carga el listado completo a propósito.
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
        await cargarActivos({ force: true, params: buildParams() });
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
          total={activosPagination.total}
          filtrados={activosPagination.total}
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
          activos={activos}
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
        <Pagination
          page={activosPagination.page}
          pageSize={activosPagination.pageSize}
          total={activosPagination.total}
          totalPages={activosPagination.totalPages}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
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
        onSuccess={(msg) => { showToast(msg); cargarActivos({ force: true, params: buildParams() }); }}
      />
      <ModalAsignacion
        isOpen={asignacionModalOpen}
        onClose={() => { setAsignacionModalOpen(false); setActivoSeleccionado(null); }}
        activo={activoSeleccionado}
        onSuccess={(msg) => { showToast(msg); cargarActivos({ force: true, params: buildParams() }); }}
      />
      <ImportDataModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => cargarActivos({ force: true, params: buildParams() })}
      />
    </div>
  );
};
