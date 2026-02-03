import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActivosStore } from '../store/activosStore';
import { X } from 'lucide-react';

const activoSchema = z.object({
  serie: z.string().min(1, 'Serie requerida'),
  marca: z.string().min(1, 'Marca requerida'),
  modelo: z.string().min(1, 'Modelo requerido'),
  tipo_dispositivo: z.enum(['Laptop', 'Desktop', 'Smartphone', 'Tablet', 'Impresora', 'Otro']),
  estado: z.enum(['Asignado', 'Disponible', 'Mantenimiento', 'Descartado']),
  rut_responsable: z.string().min(1, 'RUT requerido'),
  ubicacion: z.string().min(1, 'Ubicación requerida'),
  observaciones: z.string().optional(),
  fecha_compra: z.string().optional(),
  valor: z.string().optional(),
  numero_factura: z.string().optional(),
});

export const ModalFormulario = ({ isOpen, onClose, activo }) => {
  const { crearActivo, actualizarActivo, colaboradores, cargarColaboradores } = useActivosStore();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(activoSchema),
    defaultValues: activo || {},
  });

  useEffect(() => {
    cargarColaboradores();
  }, []);

  useEffect(() => {
    if (isOpen) {
      reset(activo || {});
    }
  }, [isOpen, activo, reset]);

  const onSubmit = async (data) => {
    const success = activo
      ? await actualizarActivo(activo.serie, data)
      : await crearActivo(data);

    if (success) {
      onClose();
      reset();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {activo ? 'Editar Activo' : 'Nuevo Activo'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Serie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serie *
              </label>
              <input
                {...register('serie')}
                disabled={!!activo}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
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
                <option value="Impresora">Impresora</option>
                <option value="Otro">Otro</option>
              </select>
              {errors.tipo_dispositivo && <p className="text-red-500 text-xs mt-1">{errors.tipo_dispositivo.message}</p>}
            </div>

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
              onClick={onClose}
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
      </div>
    </div>
  );
};
