import {
  ArrowRightLeft, Undo2, PenLine, Ban, CircleDot,
  Clock, CalendarCheck, CalendarX2, Wrench, StickyNote, CheckCircle2,
} from 'lucide-react';

/* ── Formateo de fechas (es-CL) ──────────────────────────────── */
const fmtFecha = (valor, conHora = false) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

/* ── Ciclo de vida de una Asignacion (Req. 6.1, 6.2, 6.5) ────── */
// Estilo por estado del ciclo de vida de la Asignacion.
const ESTADO_ASIGNACION_STYLE = {
  activa:          { label: 'Activa',           pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CircleDot className="w-3 h-3" /> },
  pendiente_firma: { label: 'Pendiente de firma', pill: 'bg-amber-100 text-amber-800 border-amber-200',       icon: <PenLine className="w-3 h-3" /> },
  cerrada:         { label: 'Cerrada',          pill: 'bg-gray-100 text-gray-600 border-gray-200',           icon: <CalendarCheck className="w-3 h-3" /> },
  cancelada:       { label: 'Cancelada',        pill: 'bg-red-100 text-red-700 border-red-200',              icon: <Ban className="w-3 h-3" /> },
};

// Badge del estado del ciclo de vida de la Asignacion.
export const EstadoAsignacionBadge = ({ estado }) => {
  const s = ESTADO_ASIGNACION_STYLE[estado] || {
    label: estado || 'Desconocido',
    pill: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <CircleDot className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${s.pill}`}>
      {s.icon}
      {s.label}
    </span>
  );
};

/**
 * CicloVidaAsignacion: muestra el estado del ciclo de vida de la Asignacion vigente
 * o más reciente (Task 15.5 — Req. 6.1, 6.2, 6.5):
 *  - Estado (activa/pendiente_firma/cerrada/cancelada).
 *  - Aviso visible cuando está `pendiente_firma`.
 *  - Cuando está `cerrada`: fecha inicio/fin, motivo, estado físico y fecha de firma.
 */
export const CicloVidaAsignacion = ({ asignacion }) => {
  if (!asignacion) return null;

  const estado = asignacion.estado;
  const esPendienteFirma = estado === 'pendiente_firma';
  const esCerrada = estado === 'cerrada';
  const fechaFirma = fmtFecha(asignacion.confirmado_at, true);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">Estado de la asignación</span>
        <EstadoAsignacionBadge estado={estado} />
      </div>

      {/* Aviso destacado cuando la devolución espera confirmación por firma */}
      {esPendienteFirma && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-snug">
            Devolución registrada, pendiente de confirmación de firma del colaborador.
          </p>
        </div>
      )}

      {/* Detalle del cierre (Req. 6.5) */}
      {esCerrada && (
        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>Inicio: {fmtFecha(asignacion.fecha_inicio) || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarX2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>Fin: {fmtFecha(asignacion.fecha_fin) || '—'}</span>
          </div>
          {asignacion.motivo_devolucion && (
            <div className="flex items-center gap-2">
              <StickyNote className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>Motivo: {asignacion.motivo_devolucion}</span>
            </div>
          )}
          {asignacion.estado_fisico_devolucion && (
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>Estado físico: {asignacion.estado_fisico_devolucion}</span>
            </div>
          )}
          {fechaFirma && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Firma confirmada: {fechaFirma}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Historial de asignaciones (Req. 3.1, 3.2, 3.3, 3.4) ─────── */
// Ícono según el tipo de movimiento inferido del estado de la asignación.
const iconoMovimiento = (estado) => {
  switch (estado) {
    case 'activa':          return <ArrowRightLeft className="w-3.5 h-3.5" />;
    case 'cerrada':         return <Undo2 className="w-3.5 h-3.5" />;
    case 'pendiente_firma': return <PenLine className="w-3.5 h-3.5" />;
    case 'cancelada':       return <Ban className="w-3.5 h-3.5" />;
    default:                return <CircleDot className="w-3.5 h-3.5" />;
  }
};

// Etiqueta legible del tipo de movimiento de la asignación.
const tipoMovimiento = (estado) => {
  switch (estado) {
    case 'activa':          return 'Asignación';
    case 'cerrada':         return 'Devolución';
    case 'pendiente_firma': return 'Devolución (pend. firma)';
    case 'cancelada':       return 'Cancelación';
    default:                return 'Movimiento';
  }
};

/**
 * HistorialAsignaciones: renderiza el Historial_Movimientos de un Activo
 * en orden cronológico descendente (más reciente primero).
 * Cada entrada muestra tipo, fecha, responsable, motivo/estado físico y notas
 * (Task 13.2 — Req. 3.1, 3.2, 3.3, 3.4).
 *
 * @param {Array} historial - Filas de asignaciones del backend (`/activos/:serie/asignaciones`).
 */
export const HistorialAsignaciones = ({ historial = [] }) => {
  if (!historial || historial.length === 0) {
    return <p className="text-xs text-gray-300 italic">Sin movimientos registrados</p>;
  }

  // Orden descendente por fecha (created_at, con respaldo en fecha_inicio).
  const ordenado = [...historial].sort((a, b) => {
    const fa = new Date(a.created_at || a.fecha_inicio || 0).getTime();
    const fb = new Date(b.created_at || b.fecha_inicio || 0).getTime();
    return fb - fa;
  });

  return (
    <ol className="space-y-3">
      {ordenado.map((mov, idx) => (
        <li key={mov.id ?? idx} className="relative pl-5">
          <span className="absolute left-0 top-0.5 text-gray-400">
            {iconoMovimiento(mov.estado)}
          </span>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">{tipoMovimiento(mov.estado)}</p>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {fmtFecha(mov.created_at || mov.fecha_inicio, true) || '—'}
            </span>
          </div>
          <div className="mt-0.5 space-y-0.5 text-[11px] text-gray-500 leading-snug">
            {mov.colaborador_nombre && (
              <p>Responsable: <span className="text-gray-700">{mov.colaborador_nombre}</span></p>
            )}
            {mov.rut_colaborador && (
              <p className="font-mono">RUT: {mov.rut_colaborador}</p>
            )}
            {mov.entregado_por && <p>Entregó: {mov.entregado_por}</p>}
            {mov.motivo_devolucion && <p>Motivo: {mov.motivo_devolucion}</p>}
            {mov.estado_fisico_devolucion && <p>Estado físico: {mov.estado_fisico_devolucion}</p>}
            {mov.notas && <p className="italic">“{mov.notas}”</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};

export default HistorialAsignaciones;
