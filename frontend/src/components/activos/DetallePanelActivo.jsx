import {
  X, Hash, Tag, User, MapPin, Cpu, Phone, Building2,
  Calendar, DollarSign, FileText, StickyNote, Undo2, Edit2, Package,
  AlertTriangle,
} from 'lucide-react';
import { EstadoBadge } from './EstadoBadge';
import { getTipoIcon, getTipoColor } from './constants';

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

/* ── Panel lateral ───────────────────────────────────────────── */
export const DetallePanelActivo = ({ activo, isAdmin, onEditar, onDevolucion, onAsignar, onCerrar, isDuplicate }) => {
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
          {activo.rut_responsable ? (
            <button
              onClick={() => onDevolucion(activo)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Devolver
            </button>
          ) : activo.estado === 'Disponible' ? (
            <button
              onClick={() => onAsignar(activo)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
            >
              <Package className="w-3.5 h-3.5" />
              Asignar
            </button>
          ) : null}
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
