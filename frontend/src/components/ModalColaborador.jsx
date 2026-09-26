import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActivosStore } from '../store/activosStore';
import { X, AlertTriangle, Package, CheckCircle2, XCircle } from 'lucide-react';
import { normalizeRut, validarRut } from '../utils/rut';

// Campo con label accesible asociado por id/htmlFor.
// Definido fuera del componente para no recrearse en cada render
// (evita perder el foco al escribir, requisito de navegación por teclado).
const Field = ({ label, name, required, register, errors, ...props }) => (
  <div>
    <label htmlFor={`colab-${name}`} className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required && ' *'}
    </label>
    <input
      id={`colab-${name}`}
      {...register(name)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none disabled:bg-gray-100"
      {...props}
    />
    {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name].message}</p>}
  </div>
);

const schema = z.object({
  rut:      z.string().min(1, 'RUT requerido').refine(validarRut, 'RUT inválido (verifica el dígito verificador)'),
  nombre:   z.string().min(2, 'Nombre requerido'),
  correo:   z.string().email('Email inválido').optional().or(z.literal('')),
  area:     z.string().min(1, 'Área requerida'),
  cargo:    z.string().optional(),
  telefono: z.string().optional(),
});

export const ModalColaborador = ({ isOpen, onClose, colaborador, onSuccess }) => {
  const { crearColaborador, actualizarColaborador, areas, cargarAreas, crearArea } = useActivosStore();
  const [showNuevaArea, setShowNuevaArea] = useState(false);
  const [nuevaAreaNombre, setNuevaAreaNombre] = useState('');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: colaborador ? { ...colaborador, rut: normalizeRut(colaborador.rut) } : { area: '' },
  });

  const areaWatch = watch('area');
  const correoWatch = watch('correo');

  // Ficha_Colaborador: datos derivados del colaborador existente (Req. 2.1, 2.5)
  const esEdicion = !!colaborador;
  // `activo` puede venir como boolean o null; por defecto se considera activo.
  const estaActivo = colaborador ? colaborador.activo !== false : true;
  // total_activos lo expone el backend (db/colaboradores.js); puede llegar como string.
  const totalActivos = colaborador
    ? Number(colaborador.total_activos ?? 0) || 0
    : 0;
  // Aviso de correo faltante (Req. 2.3): impide la Firma_Digital por correo.
  const correoFaltante = !correoWatch || correoWatch.trim() === '';

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
          {/* Ficha_Colaborador: resumen de estado y activos asignados (Req. 2.1, 2.5) */}
          {esEdicion && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  estaActivo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {estaActivo
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : <XCircle className="w-3.5 h-3.5" />}
                {estaActivo ? 'Activo' : 'Inactivo'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                <Package className="w-3.5 h-3.5" />
                {totalActivos} {totalActivos === 1 ? 'activo asignado' : 'activos asignados'}
              </span>
            </div>
          )}

          {/* Aviso de correo faltante (Req. 2.3): bloquea Firma_Digital por correo */}
          {correoFaltante && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <span className="font-semibold">Sin correo registrado.</span>{' '}
                La Firma Digital de devolución no podrá enviarse por correo corporativo.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="colab-rut" className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
              <input
                id="colab-rut"
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
            <Field label="Nombre completo" name="nombre" required placeholder="Juan Pérez" register={register} errors={errors} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="colab-area" className="block text-sm font-medium text-gray-700 mb-1">Área *</label>
              {!showNuevaArea ? (
                <div className="flex gap-2">
                  <select 
                    id="colab-area"
                    {...register('area', {
                      onChange: (e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setShowNuevaArea(true);
                          setValue('area', '', { shouldValidate: true });
                        } else {
                          setValue('area', e.target.value, { shouldValidate: true });
                        }
                      }
                    })} 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
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
                    aria-label="Nombre de nueva área"
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
            <Field label="Cargo" name="cargo" placeholder="Ej: Supervisor" register={register} errors={errors} />
          </div>

          <Field label="Correo electrónico" name="correo" type="email" placeholder="juan@empresa.cl" register={register} errors={errors} />
          <Field label="Teléfono" name="telefono" placeholder="+56 9 1234 5678" register={register} errors={errors} />

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
