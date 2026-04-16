import { useEffect, useState } from 'react';
import { useActivosStore } from '../store/activosStore';
import { Settings, Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle, LayoutGrid } from 'lucide-react';

export const AjustesPage = () => {
  const { areas, cargarAreas, crearArea, actualizarArea, eliminarArea } = useActivosStore();
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null); // { id, nombre }
  const [nuevaArea, setNuevaArea] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      await cargarAreas();
      setLoading(false);
    };
    fetch();
  }, [cargarAreas]);

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nuevaArea.trim()) return;
    setSaving(true);
    const res = await crearArea(nuevaArea.trim());
    if (res.ok) {
      setNuevaArea('');
    } else {
      setError(res.error);
    }
    setSaving(false);
  };

  const handleUpdate = async (id, nombre) => {
    if (!nombre.trim()) return;
    setSaving(true);
    const res = await actualizarArea(id, nombre.trim());
    if (res.ok) {
      setEditando(null);
    } else {
      setError(res.error);
    }
    setSaving(false);
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta área?')) return;
    const res = await eliminarArea(id);
    if (!res.ok) setError(res.error);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-800">Ajustes del Sistema</h1>
            <p className="text-sm text-gray-500">Configura las listas maestras y parámetros globales.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar Mini - Tabs */}
        <div className="lg:col-span-1 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-primary text-primary font-bold rounded-xl shadow-sm">
            <LayoutGrid className="w-5 h-5" />
            Gestión de Áreas
          </button>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
              Las áreas definidas aquí aparecerán como sugerencias al crear colaboradores.
            </p>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Formulario Nueva Área */}
          <form onSubmit={handleCrear} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex gap-3">
            <input
              type="text"
              value={nuevaArea}
              onChange={(e) => setNuevaArea(e.target.value)}
              placeholder="Escribe el nombre de la nueva área..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
            />
            <button
              type="submit"
              disabled={saving || !nuevaArea.trim()}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Añadir
            </button>
          </form>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Lista de Áreas */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Nombre del Área</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {areas.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      {editando?.id === a.id ? (
                        <input
                          type="text"
                          value={editando.nombre}
                          onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                          className="w-full px-3 py-1.5 border border-primary rounded-lg text-sm outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-700">{a.nombre}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editando?.id === a.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(a.id, editando.nombre)}
                              className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditando(null)}
                              className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-100 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditando({ id: a.id, nombre: a.nombre })}
                              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEliminar(a.id)}
                              className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {areas.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-10 text-center text-sm text-gray-400">
                      No hay áreas configuradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
