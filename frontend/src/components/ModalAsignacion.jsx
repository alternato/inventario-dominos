import { useState, useEffect } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { X, Package, User, Search, Mail } from 'lucide-react';

export const ModalAsignacion = ({ isOpen, onClose, activo, onSuccess }) => {
  const { colaboradores, cargarColaboradores, crearAsignacion } = useActivosStore();
  const { usuario } = useAuthStore();

  const [busqueda, setBusqueda] = useState('');
  const [colabSeleccionado, setColabSeleccionado] = useState(null);
  const [entregadoPor, setEntregadoPor] = useState('');
  const [notas, setNotas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      cargarColaboradores();
      setColabSeleccionado(null);
      setBusqueda('');
      setEntregadoPor(usuario?.nombre || '');
      setNotas('');
      setError('');
    }
  }, [isOpen]);

  const colaboradoresFiltrados = colaboradores.filter(c => {
    const q = busqueda.toLowerCase();
    return c.nombre?.toLowerCase().includes(q) || c.rut?.toLowerCase().includes(q);
  }).slice(0, 8);

  const handleConfirmar = async () => {
    if (!colabSeleccionado) return setError('Debes seleccionar un colaborador');
    setIsSubmitting(true);
    setError('');

    const result = await crearAsignacion({
      serie_activo: activo.serie,
      rut_colaborador: colabSeleccionado.rut,
      entregado_por: entregadoPor,
      notas,
    });

    setIsSubmitting(false);
    if (result.ok) {
      onSuccess?.(`Equipo asignado a ${colabSeleccionado.nombre}. Se notificó a RRHH.`);
      onClose();
    } else {
      setError(result.error || 'Error al crear la asignación');
    }
  };

  if (!isOpen || !activo) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-gray-800">Asignar Equipo</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info del activo */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-800">{activo.marca} {activo.modelo}</p>
              <p className="text-xs text-gray-500 font-mono">{activo.tipo_dispositivo} · {activo.serie}</p>
            </div>
          </div>

          {/* Buscador de colaborador */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o RUT..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setColabSeleccionado(null); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            {/* Resultado seleccionado */}
            {colabSeleccionado ? (
              <div className="mt-2 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  {colabSeleccionado.nombre?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{colabSeleccionado.nombre}</p>
                  <p className="text-xs text-gray-500">{colabSeleccionado.rut} · {colabSeleccionado.area}</p>
                </div>
                <button onClick={() => { setColabSeleccionado(null); setBusqueda(''); }} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : busqueda.length > 0 ? (
              <div className="mt-1 border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {colaboradoresFiltrados.length === 0 ? (
                  <p className="p-3 text-sm text-gray-400 text-center">Sin resultados</p>
                ) : (
                  colaboradoresFiltrados.map(c => (
                    <button
                      key={c.rut}
                      onClick={() => { setColabSeleccionado(c); setBusqueda(c.nombre); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {c.nombre?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                        <p className="text-xs text-gray-400">{c.rut} · {c.area}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {/* Entregado por */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entregado por (TI)</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={entregadoPor}
                onChange={e => setEntregadoPor(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Accesorios entregados, condición, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>

          {/* Aviso email */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
            <Mail className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Se enviará un correo informativo a <strong>rrhh@dominospizza.cl</strong> con los datos de esta asignación.
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {/* Botones */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={isSubmitting || !colabSeleccionado}
              className="px-5 py-2 text-sm bg-primary text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Asignando...' : '✓ Confirmar Asignación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
