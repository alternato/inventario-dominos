import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActivosStore } from '../store/activosStore';
import { X, AlertTriangle, UserMinus } from 'lucide-react';

const activoSchema = z.object({
  serie: z.string().min(1, 'Serie requerida'),
  marca: z.string().min(1, 'Marca requerida'),
  modelo: z.string().min(1, 'Modelo requerido'),
  tipo_dispositivo: z.enum(['Laptop', 'Desktop', 'Smartphone', 'Tablet', 'Impresora', 'SIM Card', 'Servidor', 'Monitor', 'Otro']),
  estado: z.enum(['Asignado', 'Disponible', 'Mantenimiento', 'Descartado']),
  rut_responsable: z.string().optional().nullable(),
  ubicacion: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  fecha_compra: z.string().optional().nullable(),
  valor: z.union([z.string(), z.number()]).optional().nullable(),
  numero_factura: z.string().optional().nullable(),
  imei: z.string().optional().nullable(),
  numero_sim: z.string().optional().nullable(),
  imsi: z.string().optional().nullable(),
  numero_telefono: z.string().optional().nullable(),
  compania: z.string().optional().nullable(),
});

export const ModalFormulario = ({ isOpen, onClose, activo }) => {
  const { crearActivo, actualizarActivo, colaboradores, cargarColaboradores } = useActivosStore();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(activoSchema),
    defaultValues: activo || {},
  });

  const [devolucionData, setDevolucionData] = useState(null);
  const [motivo, setMotivo] = useState('Desvinculación');
  const [faltaFirma, setFaltaFirma] = useState(false);

  const tipo = watch('tipo_dispositivo'); // Para mostrar campos condicionales
  const imei = watch('imei');

  // Lógica de replicación IMEI -> Serie para Smartphones
  useEffect(() => {
    if (tipo === 'Smartphone' && imei && !activo) {
      setValue('serie', imei);
    }
  }, [tipo, imei, setValue, activo]);

  useEffect(() => {
    cargarColaboradores();
  }, []);

  useEffect(() => {
    if (isOpen) {
      reset(activo || {});
    }
  }, [isOpen, activo, reset]);

  const onSubmit = async (data) => {
    // Detectar si es una devolución (quitando al responsable anterior)
    if (activo) {
      const responsableAnterior = activo.rut_responsable;
      const responsableNuevo = data.rut_responsable;

      if (responsableAnterior && responsableAnterior !== responsableNuevo) {
        // Es una devolución o transferencia!
        setDevolucionData(data); // Retenemos los datos, no borramos aún
        return; // Pausamos el submit
      }
    }

    ejecutarGuardadoFinal(data);
  };

  const ejecutarGuardadoFinal = async (dataAGuardar) => {
    // Forzar mayúsculas siempre
    if (dataAGuardar.serie) {
      dataAGuardar.serie = dataAGuardar.serie.trim().toUpperCase();
    }

    const success = activo
      ? await actualizarActivo(activo.serie, dataAGuardar)
      : await crearActivo(dataAGuardar);

    if (success) {
      setDevolucionData(null);
      onClose();
      reset();
    }
  };

  const confirmarDevolucion = () => {
    const payload = {
      ...devolucionData,
      motivo_devolucion: motivo,
      desvincular_usuario: motivo === 'Desvinculación',
      falta_firma: faltaFirma,
    };
    ejecutarGuardadoFinal(payload);
  };

  const handleCerrar = () => {
    setDevolucionData(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {devolucionData ? 'Asistente de Devolución' : (activo ? 'Editar Activo' : 'Nuevo Activo')}
          </h2>
          <button onClick={handleCerrar} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Asistente de Devolución */}
        {devolucionData ? (
          <div className="p-6 space-y-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  El sistema detectó que se le ha quitado la asignación de este equipo a <strong>{activo.rut_responsable}</strong>. Por favor, selecciona el motivo de devolución.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motivo de Devolución</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Desvinculación">Desvinculación del Colaborador</option>
                <option value="Cambio de Equipo">Cambio o Renovación de Equipo</option>
                <option value="Reparación">Enviado a Reparación</option>
                <option value="Licencia Prolongada">Licencia Prolongada / Vacaciones</option>
                <option value="Otro">Otro / No especificado</option>
              </select>
            </div>

            {motivo === 'Desvinculación' && (
              <div className="bg-red-50 p-4 rounded-lg flex items-center gap-3 border border-red-100">
                <UserMinus className="text-red-500 w-6 h-6 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  <strong>Acción Automática:</strong> Al confirmar, el colaborador será marcado como Inactivo en la base de datos automáticamente.
                </p>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={faltaFirma}
                  onChange={(e) => setFaltaFirma(e.target.checked)}
                  className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <div>
                  <span className="block text-sm font-medium text-gray-800">
                    Falta Firma de Recepción (Alerta Automática)
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">
                    Marque esto si el colaborador entregó el equipo sin firmar el documento de recepción. Se enviará un correo automático a Informática avisando para gestión.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={() => setDevolucionData(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={confirmarDevolucion}
                disabled={isSubmitting}
                className="px-4 py-2 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                Confirmar Devolución
              </button>
            </div>
          </div>
        ) : (
          /* Formulario Normal */
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Serie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serie *
              </label>
              <input
                {...register('serie')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:border-gray-400 focus:ring-2 focus:ring-primary"
                style={{ textTransform: 'uppercase' }}
              />
              {errors.serie && <p className="text-red-500 text-xs mt-1">{errors.serie.message}</p>}
            </div>

            {/* Tipo Dispositivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Dispositivo *
              </label>
              <select {...register('tipo_dispositivo')} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Selecciona...</option>
                <option value="Laptop">Laptop</option>
                <option value="Desktop">Desktop</option>
                <option value="Smartphone">Smartphone</option>
                <option value="Tablet">Tablet</option>
                <option value="SIM Card">SIM Card</option>
                <option value="Monitor">Monitor</option>
                <option value="Servidor">Servidor</option>
                <option value="Impresora">Impresora</option>
                <option value="Otro">Otro</option>
              </select>
              {errors.tipo_dispositivo && <p className="text-red-500 text-xs mt-1">{errors.tipo_dispositivo.message}</p>}
            </div>

            {/* IMEI (Solo Smartphone) */}
            {tipo === 'Smartphone' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IMEI *</label>
                <input {...register('imei')} placeholder="15 dígitos" className="w-full px-3 py-2 border border-blue-200 bg-blue-50/30 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            )}

            {/* Número SIM (Smartphone y SIM Card) */}
            {(tipo === 'Smartphone' || tipo === 'SIM Card') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de SIM / ICCID</label>
                  <input {...register('numero_sim')} placeholder="Número de Chip (ICCID)" className="w-full px-3 py-2 border border-blue-200 bg-blue-50/30 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número Telefónico</label>
                  <input {...register('numero_telefono')} placeholder="+569..." className="w-full px-3 py-2 border border-blue-200 bg-blue-50/30 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Compañía</label>
                  <input {...register('compania')} placeholder="Ej: Entel, Movistar" className="w-full px-3 py-2 border border-blue-200 bg-blue-50/30 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IMSI</label>
                  <input {...register('imsi')} placeholder="IMSI de 15 dígitos" className="w-full px-3 py-2 border border-blue-200 bg-blue-50/30 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </>
            )}

            {/* Marca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
              <input {...register('marca')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {errors.marca && <p className="text-red-500 text-xs mt-1">{errors.marca.message}</p>}
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
              <input {...register('modelo')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {errors.modelo && <p className="text-red-500 text-xs mt-1">{errors.modelo.message}</p>}
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
              <select {...register('estado')} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Selecciona...</option>
                <option value="Asignado">Asignado</option>
                <option value="Disponible">Disponible</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Descartado">Descartado</option>
              </select>
              {errors.estado && <p className="text-red-500 text-xs mt-1">{errors.estado.message}</p>}
            </div>

            {/* RUT Responsable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT Responsable *
              </label>
              <select {...register('rut_responsable')} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Selecciona colaborador...</option>
                {colaboradores.map((col) => (
                  <option key={col.rut} value={col.rut}>
                    {col.nombre} ({col.rut})
                  </option>
                ))}
              </select>
              {errors.rut_responsable && <p className="text-red-500 text-xs mt-1">{errors.rut_responsable.message}</p>}
            </div>

            {/* Ubicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación *</label>
              <input {...register('ubicacion')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              {errors.ubicacion && <p className="text-red-500 text-xs mt-1">{errors.ubicacion.message}</p>}
            </div>

            {/* Fecha Compra */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Compra</label>
              <input {...register('fecha_compra')} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <input {...register('valor')} type="number" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>

            {/* Número Factura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Factura</label>
              <input {...register('numero_factura')} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>

            {/* Observaciones */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea {...register('observaciones')} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={handleCerrar}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : activo ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
