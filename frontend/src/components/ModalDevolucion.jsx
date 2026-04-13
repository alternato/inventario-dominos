import { useState, useEffect } from 'react';
import { useActivosStore } from '../store/activosStore';
import { X, AlertTriangle, UserMinus, PackageCheck } from 'lucide-react';

export const ModalDevolucion = ({ isOpen, onClose, activo }) => {
  const { actualizarActivo } = useActivosStore();
  
  const [motivo, setMotivo] = useState('Desvinculación');
  const [nuevoEstado, setNuevoEstado] = useState('Disponible');
  const [faltaFirma, setFaltaFirma] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resetear estados al abrir
  useEffect(() => {
    if (isOpen) {
      setMotivo('Desvinculación');
      setNuevoEstado('Disponible');
      setFaltaFirma(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const confirmarDevolucion = async () => {
    if (!activo) return;
    
    setIsSubmitting(true);
    
    // Preparar el payload de bajada
    // Se mantiene toda la data del activo intacta, EXCEPTO que no tiene responsable
    // y se cambian los parámetros de control.
    const payload = {
      ...activo,
      rut_responsable: null,
      estado: nuevoEstado,
      motivo_devolucion: motivo,
      desvincular_usuario: motivo === 'Desvinculación',
      falta_firma: faltaFirma,
    };

    const success = await actualizarActivo(activo.serie, payload);
    
    setIsSubmitting(false);
    if (success) {
      onClose();
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
            <h2 className="text-xl font-bold text-gray-800">
              Asistente de Devolución
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-orange-800 font-medium">
                  Estás a punto de desasignar este equipo.
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Equipo: <strong>{activo.marca} {activo.modelo} (Serie: {activo.serie})</strong><br/>
                  Actual Responsable: <strong>{activo.colaborador?.nombre || activo.rut_responsable}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motivo Fuerte</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Desvinculación">Desvinculación del Colaborador</option>
                <option value="Cambio de Equipo">Cambio o Renovación</option>
                <option value="Reparación">Enviado a Reparación</option>
                <option value="Licencia Prolongada">Licencia / Vacaciones</option>
                <option value="Término de Proyecto">Término de Proyecto</option>
                <option value="Otro">Otro / No especificado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado Físico al Entregar</label>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 bg-blue-50/20 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Disponible">Disponible (Bueno)</option>
                <option value="Mantenimiento">Mantenimiento (Revisión)</option>
                <option value="Descartado">Descartado (Baja final)</option>
              </select>
            </div>
          </div>

          {motivo === 'Desvinculación' && (
            <div className="bg-red-50 p-4 rounded-lg flex items-center gap-3 border border-red-100">
              <UserMinus className="text-red-500 w-6 h-6 flex-shrink-0" />
              <p className="text-xs text-red-700">
                <strong>Acción Automática:</strong> Al confirmar, el perfil del colaborador pasará a estado Inactivo globalmente.
              </p>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={faltaFirma}
                onChange={(e) => setFaltaFirma(e.target.checked)}
                className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <div>
                <span className="block text-sm font-bold text-gray-800">
                  Falta Firma de Recepción (Alerta Automática)
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  Marque esto si el equipo o accesorios fueron dejados físicamente pero no se firmó el documento. Se enviará un correo a Informática.
                </span>
              </div>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarDevolucion}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar Devolución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
