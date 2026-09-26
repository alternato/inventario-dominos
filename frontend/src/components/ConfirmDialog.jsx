import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * ConfirmDialog: confirmación explícita de una operación destructiva (Req. 5.5).
 *
 * Nombra la entidad a eliminar por su tipo + identificador visible y solo dispara
 * `onConfirm` (p. ej. la llamada al endpoint de borrado) cuando el operador pulsa
 * el botón de confirmación. Nunca lo dispara al montar ni al cancelar/cerrar.
 *
 * Contrato de disparo:
 * - Montar el componente (isOpen=true) NO llama a onConfirm.
 * - Cancelar / cerrar / Escape / clic en el backdrop llaman a onCancel, nunca a onConfirm.
 * - onConfirm se invoca exactamente una vez por confirmación explícita del operador,
 *   y se bloquea el reenvío mientras la promesa devuelta esté pendiente.
 *
 * Accesibilidad: role="dialog" + aria-modal, foco inicial en el botón de cancelar
 * (acción no destructiva) y cierre con Escape.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {string} [props.entidad] - Tipo de entidad (Activo, Colaborador...).
 * @param {string} [props.identificador] - Identificador visible (serie, RUT...).
 * @param {string} [props.title] - Título; por defecto se compone con la entidad.
 * @param {string} [props.message] - Texto adicional bajo el título.
 * @param {string} [props.confirmLabel] - Texto del botón de confirmación.
 * @param {string} [props.cancelLabel] - Texto del botón de cancelar.
 * @param {() => (void | Promise<void>)} props.onConfirm - Acción destructiva (endpoint).
 * @param {() => void} props.onCancel - Cierra el diálogo sin ejecutar la acción.
 */
export const ConfirmDialog = ({
  isOpen,
  entidad,
  identificador,
  title,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const cancelBtnRef = useRef(null);

  // Reset del estado de proceso cada vez que se abre el diálogo.
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      // Enfocar la acción no destructiva por defecto.
      cancelBtnRef.current?.focus();
    }
  }, [isOpen]);

  // Cerrar con Escape (equivale a cancelar, nunca confirma).
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isProcessing) {
        onCancel?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isProcessing, onCancel]);

  if (!isOpen) return null;

  const entidadTexto = [entidad, identificador].filter(Boolean).join(' ');
  const tituloFinal =
    title || (entidadTexto ? `¿Eliminar ${entidadTexto}?` : '¿Confirmar eliminación?');

  const handleConfirm = async () => {
    // Antirreenvío: solo el clic explícito llega aquí, y se bloquea si ya
    // hay una confirmación en curso.
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm?.();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (isProcessing) return;
    onCancel?.();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-desc' : undefined}
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" aria-hidden="true" />
            <h2 id="confirm-dialog-title" className="text-lg font-bold text-gray-800">
              {tituloFinal}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            aria-label="Cerrar"
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50 outline-none focus:ring-2 focus:ring-gray-400 rounded"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <p className="text-sm text-red-800">
              Esta acción no se puede deshacer. Se eliminará{' '}
              {entidadTexto ? (
                <>
                  {entidad ? `${entidad} ` : 'el registro '}
                  <strong>{identificador}</strong>
                </>
              ) : (
                'el registro seleccionado'
              )}
              .
            </p>
          </div>
          {message && (
            <p id="confirm-dialog-desc" className="text-sm text-gray-600">
              {message}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end p-5 border-t">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm outline-none focus:ring-2 focus:ring-gray-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm outline-none focus:ring-2 focus:ring-red-500"
          >
            {isProcessing ? 'Eliminando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
