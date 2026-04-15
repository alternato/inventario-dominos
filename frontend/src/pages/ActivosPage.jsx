import { useEffect, useState } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import {
  Edit2, Trash2, Plus, Search, Laptop, Smartphone, Wifi,
  HardDrive, Package, Upload, Undo2, X, ChevronRight,
  MapPin, User, Tag, Hash, Phone, Building2, Cpu, AlertTriangle,
  Calendar, DollarSign, FileText, StickyNote
} from 'lucide-react';
import { ModalFormulario } from '../components/ModalFormulario';
import { ModalDevolucion } from '../components/ModalDevolucion';
import ImportDataModal from '../components/ImportDataModal';
import { useLocation } from 'react-router-dom';

/* ── Helpers ─────────────────────────────────────────────────── */
const ESTADOS = ['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'];

const ESTADO_STYLE = {
  Asignado:      { pill: 'bg-emerald-100 text-emerald-800 border border-emerald-200', dot: 'bg-emerald-500' },
  Disponible:    { pill: 'bg-amber-100   text-amber-800   border border-amber-200',   dot: 'bg-amber-400'   },
  Mantenimiento: { pill: 'bg-red-100     text-red-800     border border-red-200',     dot: 'bg-red-500'     },
  Descartado:    { pill: 'bg-gray-100    text-gray-600    border border-gray-200',    dot: 'bg-gray-400'    },
};

const TIPO_ICON = {
  Laptop:     <Laptop className="w-4 h-4" />,
  Smartphone: <Smartphone className="w-4 h-4" />,
  'SIM Card': <Wifi className="w-4 h-4" />,
  Desktop:    <HardDrive className="w-4 h-4" />,
};

const TIPO_COLOR = {
  Laptop:     'bg-blue-50   text-blue-600',
  Smartphone: 'bg-purple-50 text-purple-600',
  'SIM Card': 'bg-teal-50   text-teal-600',
  Desktop:    'bg-sky-50    text-sky-600',
};

function getTipoIcon(tipo) {
  return TIPO_ICON[tipo] ?? <Package className="w-4 h-4" />;
}

function getTipoColor(tipo) {
  return TIPO_COLOR[tipo] ?? 'bg-gray-50 text-gray-500';
}

/* ── Componente principal ────────────────────────────────────── */
export const ActivosPage = () => {
  const { activos, cargarActivos, eliminarActivo } = useActivosStore();
  const { isAdmin } = useAuthStore();
  const location = useLocation();

  const [busqueda,    setBusqueda]    = useState(location.state?.busqueda    || '');
  const [filtroEstado, setFiltroEstado] = useState(location.state?.filtroEstado || '');
  const [modalOpen,           setModalOpen]           = useState(false);
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);
  const [importModalOpen,     setImportModalOpen]     = useState(false);
  const [activoSeleccionado,  setActivoSeleccionado]  = useState(null);
  const [panelActivo,         setPanelActivo]         = useState(null); // panel lateral

  useEffect(() => { cargarActivos(); }, []);

  // Cerrar panel si se presiona Escape
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

  const isDuplicate = (activo) =>
    activos.some(a =>
      a.serie !== activo.serie && (
        (a.imei && activo.imei && a.imei === activo.imei) ||
        (a.numero_telefono && activo.numero_telefono && a.numero_telefono === activo.numero_telefono)
      )
    );

  return (
    /* Wrapper con overflow hidden para que el panel lateral no se salga */
    <div className="flex h-full gap-0 overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── Columna principal ───────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col gap-5 overflow-y-auto transition-all duration-300"
        style={{ minWidth: 0 }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Activos</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {activosFiltrados.length} de {activos.length} equipos
              {filtroEstado && <span className="ml-1 text-primary font-medium">· {filtroEstado}</span>}
            </p>
          </div>

          {isAdmin() && (
            <div className="flex gap-2">
              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
              >
                <Upload className="w-4 h-4" />
                Importar
              </button>
              <button
                onClick={() => { setActivoSeleccionado(null); setModalOpen(true); }}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo Activo
              </button>
            </div>
          )}
        </div>

        {/* Barra de búsqueda + filtros de estado */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por serie, marca, modelo, responsable..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="bg-transparent flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Chips de estado */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFiltroEstado('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filtroEstado === '' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
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

        {/* Tabla */}
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
                  {isAdmin() && (
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activosFiltrados.map((activo) => {
                  const isSelected = panelActivo?.serie === activo.serie;
                  const dup = isDuplicate(activo);
                  return (
                    <tr
                      key={activo.serie}
                      onClick={() => setPanelActivo(isSelected ? null : activo)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-2 border-l-primary'
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      {/* Dispositivo */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTipoColor(activo.tipo_dispositivo)}`}>
                            {getTipoIcon(activo.tipo_dispositivo)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm leading-tight flex items-center gap-1.5">
                              {activo.marca}
                              {dup && (
                                <span
                                  title="Posible duplicado (IMEI o teléfono repetido)"
                                  className="text-amber-500"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </p>
                            <p className="text-gray-400 text-xs">{activo.modelo}</p>
                          </div>
                        </div>
                      </td>

                      {/* Serie */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {activo.serie}
                        </span>
                      </td>

                      {/* Responsable */}
                      <td className="px-5 py-3.5 text-sm text-gray-700">
                        {activo.colaborador?.nombre
                          ? <span>{activo.colaborador.nombre}</span>
                          : <span className="text-gray-300 text-xs italic">— Sin asignar</span>}
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-3.5">
                        <EstadoBadge estado={activo.estado} />
                      </td>

                      {/* Ubicación */}
                      <td className="px-5 py-3.5 text-sm text-gray-600 max-w-[160px] truncate">
                        {activo.ubicacion || <span className="text-gray-300 text-xs italic">—</span>}
                      </td>

                      {/* Acciones (admin) */}
                      {isAdmin() && (
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            {activo.rut_responsable && (
                              <button
                                onClick={(e) => handleDevolucionRapida(activo, e)}
                                className="p-1.5 hover:bg-orange-100 rounded-lg text-orange-400 transition"
                                title="Desasignar / Devolver"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleEditar(activo, e)}
                              className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-500 transition"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEliminar(activo.serie); }}
                              className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 transition"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}

                      {/* Flecha indicadora */}
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

          {activosFiltrados.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay activos que coincidan con la búsqueda</p>
              {(busqueda || filtroEstado) && (
                <button
                  onClick={() => { setBusqueda(''); setFiltroEstado(''); }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel lateral de detalle ─────────────────────────────── */}
      <div
        className={`flex-shrink-0 overflow-y-auto bg-white border-l border-gray-200 shadow-xl transition-all duration-300 ease-in-out ${
          panelActivo ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        {panelActivo && <DetallePanelActivo
          activo={panelActivo}
          isAdmin={isAdmin()}
          onEditar={(a) => handleEditar(a)}
          onDevolucion={(a) => handleDevolucionRapida(a)}
          onCerrar={() => setPanelActivo(null)}
          isDuplicate={isDuplicate(panelActivo)}
        />}
      </div>

      {/* ── Modales ───────────────────────────────────────────────── */}
      <ModalFormulario
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setActivoSeleccionado(null); }}
        activo={activoSeleccionado}
      />
      <ModalDevolucion
        isOpen={devolucionModalOpen}
        onClose={() => { setDevolucionModalOpen(false); setActivoSeleccionado(null); }}
        activo={activoSeleccionado}
      />
      <ImportDataModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={() => cargarActivos()}
      />
    </div>
  );
};

/* ── Panel lateral ───────────────────────────────────────────── */
const DetallePanelActivo = ({ activo, isAdmin, onEditar, onDevolucion, onCerrar, isDuplicate }) => {
  const tipo = activo.tipo_dispositivo;
  const esTelefonia = tipo === 'Smartphone' || tipo === 'SIM Card';

  return (
    <div className="flex flex-col h-full">
      {/* Header del panel */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTipoColor(tipo)}`}>
            {getTipoIcon(tipo)}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm leading-tight">{activo.marca} {activo.modelo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{tipo}</p>
          </div>
        </div>
        <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Estado + badge duplicado */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <EstadoBadge estado={activo.estado} />
        {isDuplicate && (
          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 text-xs px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Duplicado
          </span>
        )}
      </div>

      {/* Cuerpo scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Identificación */}
        <SeccionDetalle titulo="Identificación">
          <DetalleItem icon={<Hash />}      label="Serie"  valor={activo.serie} mono />
          <DetalleItem icon={<Tag />}       label="Tipo"   valor={activo.tipo_dispositivo} />
        </SeccionDetalle>

        {/* Asignación */}
        <SeccionDetalle titulo="Asignación">
          <DetalleItem icon={<User />}     label="Responsable" valor={activo.colaborador?.nombre} fallback="Sin asignar" />
          <DetalleItem icon={<MapPin />}   label="Ubicación"   valor={activo.ubicacion} />
        </SeccionDetalle>

        {/* Telefonía (condicional) */}
        {esTelefonia && (
          <SeccionDetalle titulo="Telefonía">
            {activo.imei        && <DetalleItem icon={<Cpu />}       label="IMEI / ICCID"  valor={activo.imei} mono />}
            {activo.numero_sim  && <DetalleItem icon={<Hash />}      label="N° SIM"        valor={activo.numero_sim} mono />}
            {activo.numero_telefono && <DetalleItem icon={<Phone />} label="Teléfono"      valor={activo.numero_telefono} />}
            {activo.compania    && <DetalleItem icon={<Building2 />} label="Compañía"      valor={activo.compania} />}
            {activo.imsi        && <DetalleItem icon={<Cpu />}       label="IMSI"          valor={activo.imsi} mono />}
          </SeccionDetalle>
        )}

        {/* Datos financieros */}
        {(activo.fecha_compra || activo.valor || activo.numero_factura) && (
          <SeccionDetalle titulo="Datos de adquisición">
            {activo.fecha_compra    && <DetalleItem icon={<Calendar />}   label="Fecha compra" valor={activo.fecha_compra} />}
            {activo.valor           && <DetalleItem icon={<DollarSign />} label="Valor"        valor={`$${Number(activo.valor).toLocaleString('es-CL')}`} />}
            {activo.numero_factura  && <DetalleItem icon={<FileText />}   label="N° Factura"   valor={activo.numero_factura} />}
          </SeccionDetalle>
        )}

        {/* Observaciones */}
        {activo.observaciones && (
          <SeccionDetalle titulo="Observaciones">
            <div className="flex gap-2 text-sm text-gray-600">
              <StickyNote className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{activo.observaciones}</p>
            </div>
          </SeccionDetalle>
        )}
      </div>

      {/* Footer con acciones */}
      {isAdmin && (
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {activo.rut_responsable && (
            <button
              onClick={() => onDevolucion(activo)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Devolver
            </button>
          )}
          <button
            onClick={() => onEditar(activo)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-blue-700 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Editar ficha
          </button>
        </div>
      )}
    </div>
  );
};

/* ── Sub-componentes del panel ───────────────────────────────── */
const SeccionDetalle = ({ titulo, children }) => (
  <div>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{titulo}</p>
    <div className="space-y-2">{children}</div>
  </div>
);

const DetalleItem = ({ icon, label, valor, fallback = '—', mono = false }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-gray-400 mt-0.5 flex-shrink-0 w-3.5 h-3.5">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
      <p className={`text-sm text-gray-700 break-all leading-snug ${mono ? 'font-mono' : ''}`}>
        {valor || <span className="text-gray-300 italic text-xs">{fallback}</span>}
      </p>
    </div>
  </div>
);

/* ── Estado Badge ─────────────────────────────────────────────── */
const EstadoBadge = ({ estado }) => {
  const style = ESTADO_STYLE[estado] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {estado}
    </span>
  );
};
