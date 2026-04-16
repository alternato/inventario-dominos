import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActivosStore } from '../store/activosStore';
import { X } from 'lucide-react';

const schema = z.object({
  rut:      z.string().min(1, 'RUT requerido'),
  nombre:   z.string().min(2, 'Nombre requerido'),
  correo:   z.string().email('Email inválido').optional().or(z.literal('')),
  area:     z.string().min(1, 'Área requerida'),
  cargo:    z.string().optional(),
  telefono: z.string().optional(),
});

// Elimina puntos y asegura formato XXXXXXXX-X
const normalizeRut = (raw = '') => {
  // Quitar todo excepto dígitos, K y guion
  let clean = raw.replace(/\./g, '').replace(/[^0-9kK-]/g, '').toUpperCase();
  // Si no tiene guion pero tiene más de 1 char, insertar guion antes del último
  if (!clean.includes('-') && clean.length > 1) {
    clean = clean.slice(0, -1) + '-' + clean.slice(-1);
  }
  return clean;
};

export const ModalColaborador = ({ isOpen, onClose, colaborador, onSuccess }) => {
  const { crearColaborador, actualizarColaborador, areas, cargarAreas, crearArea } = useActivosStore();
  const [showNuevaArea, setShowNuevaArea] = useState(false);
  const [nuevaAreaNombre, setNuevaAreaNombre] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: colaborador ? { ...colaborador, rut: normalizeRut(colaborador.rut) } : { area: '' },
  });

  const areaWatch = watch('area');

  useEffect(() => {
    if (isOpen) {
      cargarAreas();
      reset(colaborador ? { ...colaborador, rut: normalizeRut(colaborador.rut) } : { area: '' });
      setShowNuevaArea(false);
    }
  }, [isOpen, colaborador, reset, cargarAreas]);

  const onSubmit = async (data) => {
    let finalArea = data.area;

    // Si es una nueva área, primero la creamos en la lista maestra
    if (showNuevaArea && nuevaAreaNombre.trim()) {
      const areaResult = await crearArea(nuevaAreaNombre.trim());
      if (areaResult.ok) {
        finalArea = nuevaAreaNombre.trim();
      } else {
        alert('Error al crear la nueva área: ' + areaResult.error);
        return;
      }
    }

    const payload = { ...data, area: finalArea, rut: normalizeRut(data.rut) };

    const result = colaborador
      ? await actualizarColaborador(colaborador.rut, payload)
      : await crearColaborador(payload);

    if (result.ok) {
      onSuccess?.(colaborador ? 'Colaborador actualizado' : 'Colaborador creado');
      onClose();
    } else {
      alert(result.error || 'Error al guardar');
    }
  };

  if (!isOpen) return null;

  const Field = ({ label, name, required, ...props }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        {...register(name)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100"
        {...props}
      />
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {colaborador ? 'Editar Colaborador' : 'Nuevo Colaborador'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
              <input
                {...register('rut')}
                placeholder="12345678-9"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100"
                onChange={(e) => {
                  const normalized = normalizeRut(e.target.value);
                  setValue('rut', normalized, { shouldValidate: true });
                }}
                disabled={!!colaborador}
              />
              {errors.rut && <p className="text-red-500 text-xs mt-1">{errors.rut.message}</p>}
              {colaborador && (
                <p className="text-xs text-amber-600 mt-1">⚠️ Cambia solo si el RUT era incorrecto</p>
              )}
            </div>
            <Field label="Nombre completo" name="nombre" required placeholder="Juan Pérez" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área *</label>
              {!showNuevaArea ? (
                <div className="flex gap-2">
                  <select 
                    {...register('area')} 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setShowNuevaArea(true);
                        setValue('area', '');
                      } else {
                        setValue('area', e.target.value);
                      }
                    }}
                  >
                    <option value="">Seleccionar área...</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.nombre}>{a.nombre}</option>
                    ))}
                    <option value="ADD_NEW" className="text-primary font-bold">+ Añadir nueva área...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuevaAreaNombre}
                    onChange={(e) => setNuevaAreaNombre(e.target.value)}
                    placeholder="Nombre de nueva área"
                    className="flex-1 px-3 py-2 border border-primary rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNuevaArea(false)}
                    className="px-2 text-xs text-gray-500 hover:text-red-500"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
            </div>
            <Field label="Cargo" name="cargo" placeholder="Ej: Supervisor" />
          </div>

          <Field label="Correo electrónico" name="correo" type="email" placeholder="juan@empresa.cl" />
          <Field label="Teléfono" name="telefono" placeholder="+56 9 1234 5678" />

          <div className="flex gap-3 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : colaborador ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
