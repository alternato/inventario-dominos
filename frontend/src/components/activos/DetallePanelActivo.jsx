import { useEffect, useState } from 'react';
import {
  X, Hash, Tag, User, MapPin, Cpu, Phone, Building2,
  Calendar, DollarSign, FileText, StickyNote, Undo2, Edit2, Package,
  AlertTriangle, UserCheck, History, Signal,
} from 'lucide-react';
import { EstadoBadge } from './EstadoBadge';
import { getTipoIcon, getTipoColor } from './constants';
import { HistorialAsignaciones, CicloVidaAsignacion } from './HistorialAsignaciones';
import { CompletitudBadge } from '../CompletitudBadge';
import { calcularCompletitud, camposRecomendados, esTipoMovil } from '../../utils/completitud';
import { activosAPI } from '../../api';
import { useActivosStore } from '../../store/activosStore';

/* ── Sub-componentes del panel ───────────────────────────────── */
const SeccionDetalle = ({ titulo, extra, children }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{titulo}</p>
      {extra}
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const DetalleItem = ({ icon, label, valor, fallback = '—', mono = false, recomendadoVacio = false }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-gray-400 mt-0.5 flex-shrink-0 w-3.5 h-3.5">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
      {valor ? (
        <p className={`text-sm text-gray-700 break-all leading-snug ${mono ? 'font-mono' : ''}`}>{valor}</p>
      ) : recomendadoVacio ? (
        <CompletitudBadge campo={label} texto="Incompleto" className="mt-0.5" />
      ) : (
        <p className="text-sm"><span className="text-gray-300 italic text-xs">{fallback}</span></p>
      )}
    </div>
  </div>
);

// Barra de progreso del indicador de completitud (Req. 1.5).
const CompletitudIndicador = ({ porcentaje }) => {
  const color =
    porcentaje >= 80 ? 'bg-emerald-500' :
    porcentaje >= 50 ? 'bg-amber-400' :
    'bg-red-400';
  return (
    <div className="flex items-center gap-2" title={`Completitud de la ficha: ${porcentaje}%`}>
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${porcentaje}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-gray-500 tabular-nums">{porcentaje}%</span>
    </div>
  );
};

const fmtFecha = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' });
};

/* ── Panel lateral ───────────────────────────────────────────── */
export const DetallePanelActivo = ({ activo, isAdmin, onEditar, onDevolucion, onAsignar, onCerrar, isDuplicate }) => {
  const cargarAsignacionesActivo = useActivosStore((s) => s.cargarAsignacionesActivo);

  // La fila de listado no trae `inconsistente`/`asignacion_activa`; se enriquece
  // con la Ficha_Activo completa del backend al abrir el panel.
  const [ficha, setFicha] = useState(activo);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    let vivo = true;
    setFicha(activo);
    setHistorial([]);

    activosAPI.obtener(activo.serie)
      .then((res) => {
        if (!vivo) return;
        const detalle = res.data?.data || res.data;
        if (detalle) setFicha((prev) => ({ ...prev, ...detalle }));
      })
      .catch(() => { /* se conserva la fila de listado como respaldo */ });

    cargarAsignacionesActivo(activo.serie).then((res) => {
      if (vivo && res?.ok) setHistorial(res.data || []);
    });

    return () => { vivo = false; };
  }, [activo, cargarAsignacionesActivo]);

  const tipo = ficha.tipo_dispositivo;
  const esMovil = esTipoMovil(tipo);
  const completitud = calcularCompletitud(ficha);
  const recomendados = camposRecomendados(tipo);
  const esRecomendado = (campo) => recomendados.includes(campo);

  // Asignación vigente: la primera 'activa' del historial, con respaldo en la Ficha.
  const asignacionActiva = historial.find((a) => a.estado === 'activa');
  // Para el ciclo de vida (Task 15.5): activa si existe, si no la más reciente.
  const asignacionCiclo = asignacionActiva || historial[0] || null;
  const asignado = Boolean(asignacionActiva || ficha.rut_responsable);
  const nombreResponsable = ficha.colaborador?.nombre || asignacionActiva?.colaborador_nombre;
  const fechaInicioAsig = fmtFecha(asignacionActiva?.fecha_inicio || ficha.asignacion_fecha_inicio);

  return (
    <div className="flex flex-col h-full">
      {/* Header del panel */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTipoColor(tipo)}`}>
            {getTipoIcon(tipo)}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm leading-tight">{ficha.marca} {ficha.modelo}</p>
            <p className="text-xs text-gray-400 mt-0.5">{tipo}</p>
          </div>
        </div>
        <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 p-1 rounded" aria-label="Cerrar ficha">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Estado + badges (duplicado, inconsistencia) */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <EstadoBadge estado={ficha.estado} />
        {isDuplicate && (
          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 text-xs px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Duplicado
          </span>
        )}
        {ficha.inconsistente && (
          <span
            className="flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 text-xs px-2 py-0.5 rounded-full"
            title="El activo está 'Asignado' pero no tiene una asignación activa"
          >
            <AlertTriangle className="w-3 h-3" />
            Inconsistencia estado/asignación
          </span>
        )}
      </div>

      {/* Cuerpo scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Identificación + completitud */}
        <SeccionDetalle titulo="Identificación" extra={<CompletitudIndicador porcentaje={completitud} />}>
          <DetalleItem icon={<Hash />} label="Serie" valor={ficha.serie} mono />
          <DetalleItem icon={<Tag />}  label="Tipo"  valor={tipo} />
          <DetalleItem icon={<Package />} label="Marca"  valor={ficha.marca}  recomendadoVacio={esRecomendado('marca')} />
          <DetalleItem icon={<Package />} label="Modelo" valor={ficha.modelo} recomendadoVacio={esRecomendado('modelo')} />
        </SeccionDetalle>

        {/* Asignación vigente */}
        <SeccionDetalle titulo="Asignación">
          {asignado ? (
            <>
              <DetalleItem icon={<User />}      label="Responsable"   valor={nombreResponsable} fallback="Sin nombre" />
              <DetalleItem icon={<Calendar />}  label="Fecha inicio"  valor={fechaInicioAsig} />
              {asignacionActiva?.entregado_por && (
                <DetalleItem icon={<UserCheck />} label="Entregado por" valor={asignacionActiva.entregado_por} />
              )}
              <DetalleItem icon={<MapPin />} label="Ubicación" valor={ficha.ubicacion} recomendadoVacio={esRecomendado('ubicacion')} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Package className="w-4 h-4 flex-shrink-0" />
                Disponible — sin responsable asignado
              </div>
              <DetalleItem icon={<MapPin />} label="Ubicación" valor={ficha.ubicacion} recomendadoVacio={esRecomendado('ubicacion')} />
            </>
          )}
        </SeccionDetalle>

        {/* Ciclo de vida de la asignación (Task 15.5) */}
        {asignacionCiclo && (
          <SeccionDetalle titulo="Ciclo de vida de la asignación">
            <CicloVidaAsignacion asignacion={asignacionCiclo} />
          </SeccionDetalle>
        )}

        {/* Datos móviles (condicional por tipo: Smartphone / Tablet / SIM Card) */}
        {esMovil && (
          <SeccionDetalle titulo="Telefonía / Conectividad">
            <DetalleItem icon={<Cpu />}       label="IMEI / ICCID" valor={ficha.imei}            mono recomendadoVacio={esRecomendado('imei')} />
            <DetalleItem icon={<Hash />}      label="N° SIM"       valor={ficha.numero_sim}     mono recomendadoVacio={esRecomendado('numero_sim')} />
            <DetalleItem icon={<Signal />}    label="IMSI"         valor={ficha.imsi}           mono recomendadoVacio={esRecomendado('imsi')} />
            <DetalleItem icon={<Phone />}     label="Teléfono"     valor={ficha.numero_telefono}     recomendadoVacio={esRecomendado('numero_telefono')} />
            <DetalleItem icon={<Building2 />} label="Compañía"     valor={ficha.compania}            recomendadoVacio={esRecomendado('compania')} />
          </SeccionDetalle>
        )}

        {/* Datos de adquisición (recomendados: siempre visibles con badge si faltan) */}
        <SeccionDetalle titulo="Datos de adquisición">
          <DetalleItem icon={<Calendar />}   label="Fecha compra" valor={fmtFecha(ficha.fecha_compra)} recomendadoVacio={esRecomendado('fecha_compra')} />
          <DetalleItem icon={<DollarSign />} label="Valor"        valor={ficha.valor != null && ficha.valor !== '' ? `$${Number(ficha.valor).toLocaleString('es-CL')}` : null} recomendadoVacio={esRecomendado('valor')} />
          <DetalleItem icon={<FileText />}   label="N° Factura"   valor={ficha.numero_factura} recomendadoVacio={esRecomendado('numero_factura')} />
        </SeccionDetalle>

        {/* Observaciones */}
        <SeccionDetalle titulo="Observaciones">
          {ficha.observaciones ? (
            <div className="flex gap-2 text-sm text-gray-600">
              <StickyNote className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{ficha.observaciones}</p>
            </div>
          ) : (
            <CompletitudBadge campo="observaciones" texto="Incompleto" />
          )}
        </SeccionDetalle>

        {/* Historial de movimientos (descendente) */}
        <SeccionDetalle
          titulo="Historial de movimientos"
          extra={<History className="w-3.5 h-3.5 text-gray-300" />}
        >
          <HistorialAsignaciones historial={historial} />
        </SeccionDetalle>
      </div>

      {/* Footer con acciones */}
      {isAdmin && (
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {ficha.rut_responsable ? (
            <button
              onClick={() => onDevolucion(ficha)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Devolver
            </button>
          ) : ficha.estado === 'Disponible' ? (
            <button
              onClick={() => onAsignar(ficha)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
            >
              <Package className="w-3.5 h-3.5" />
              Asignar
            </button>
          ) : null}
          <button
            onClick={() => onEditar(ficha)}
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
