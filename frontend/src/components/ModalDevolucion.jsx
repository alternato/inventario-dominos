import { useState, useEffect } from 'react';
import { useActivosStore } from '../store/activosStore';
import { X, AlertTriangle, UserMinus, PackageCheck, Mail, Info } from 'lucide-react';

export const ModalDevolucion = ({ isOpen, onClose, activo, onSuccess }) => {
  const { cerrarAsignacion, cargarAsignacionesActivo } = useActivosStore();

  const [motivo, setMotivo] = useState('Desvinculación');
  const [nuevoEstado, setNuevoEstado] = useState('Disponible');
  const [desvincular, setDesvincular] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [asignacionActiva, setAsignacionActiva] = useState(null);
  const [correoAlterno, setCorreoAlterno] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && activo) {
      setMotivo('Desvinculación');
      setNuevoEstado('Disponible');
      setDesvincular(false);
      setIsSubmitting(false);
      setCorreoAlterno('');
      setError('');
      // Cargar asignación activa
      cargarAsignacionesActivo(activo.serie).then(res => {
        const activas = (res.data || []).filter(a => a.estado === 'activa');
        setAsignacionActiva(activas[0] || null);
      });
    }
  }, [isOpen, activo]);

  const tieneCorreoCorporativo = !!(activo?.colaborador?.correo || activo?.colaborador_correo);
  const correoCorporativo = activo?.colaborador?.correo || activo?.colaborador_correo || '';
  const necesitaCorreoAlterno = !tieneCorreoCorporativo;

  const confirmarDevolucion = async () => {
    if (!activo) return;
    if (!asignacionActiva) {
      setError('No se encontró una asignación activa para este equipo.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const result = await cerrarAsignacion(asignacionActiva.id, {
      motivo_devolucion: motivo,
      estado_fisico_devolucion: nuevoEstado,
      desvincular_colaborador: motivo === 'Desvinculación' && desvincular,
      correo_alterno: necesitaCorreoAlterno ? correoAlterno : null,
    });

    setIsSubmitting(false);
    if (result.ok) {
      onSuccess?.('Devolución registrada. Se envió confirmación al colaborador.');
      onClose();
    } else {
      setError(result.error || 'Error al registrar la devolución');
    }
  };

  if (!isOpen || !activo) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-800">Registrar Devolución</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info equipo + colaborador */}
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-orange-800 font-medium">Desasignando equipo</p>
                <p className="text-xs text-orange-700 mt-1">
                  <strong>{activo.marca} {activo.modelo}</strong> · {activo.serie}<br />
                  Responsable: <strong>{activo.colaborador?.nombre || activo.rut_responsable}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Motivo y Estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de devolución</label>
              <select
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
              >
                <option value="Desvinculación">Desvinculación del Colaborador</option>
                <option value="Cambio de Equipo">Cambio o Renovación</option>
                <option value="Reparación">Enviado a Reparación</option>
                <option value="Licencia Prolongada">Licencia / Vacaciones</option>
                <option value="Término de Proyecto">Término de Proyecto</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado físico al entregar</label>
              <select
                value={nuevoEstado}
                onChange={e => setNuevoEstado(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 bg-blue-50/20 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="Disponible">Disponible (Bueno)</option>
                <option value="Mantenimiento">Mantenimiento (Revisión)</option>
                <option value="Descartado">Descartado (Baja final)</option>
              </select>
            </div>
          </div>

          {/* Desvincular colaborador */}
          {motivo === 'Desvinculación' && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={desvincular}
                  onChange={e => setDesvincular(e.target.checked)}
                  className="mt-1 w-4 h-4 text-red-500 rounded border-gray-300"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <UserMinus className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-red-800">Marcar colaborador como Inactivo</span>
                  </div>
                  <span className="text-xs text-red-600 mt-0.5 block">El perfil del colaborador quedará desactivado en el sistema.</span>
                </div>
              </label>
            </div>
          )}

          {/* Confirmación por email */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-gray-700">Confirmación digital</span>
            </div>

            {tieneCorreoCorporativo ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>Se enviará un link de confirmación a <strong>{correoCorporativo}</strong></span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                  Este colaborador no tiene correo corporativo registrado.
                  Ingresa un correo alternativo para enviarle la confirmación:
                </p>
                <input
                  type="email"
                  placeholder="correo.personal@gmail.com (opcional)"
                  value={correoAlterno}
                  onChange={e => setCorreoAlterno(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                />
                {!correoAlterno && (
                  <p className="text-xs text-gray-400">Si lo dejas vacío, la devolución quedará marcada como <em>pendiente de firma</em>.</p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarDevolucion}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 text-sm"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar Devolución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
