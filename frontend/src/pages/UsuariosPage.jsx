import { useEffect, useState } from 'react';
import { usuariosAPI } from '../api';
import { Shield, Check, X, AlertCircle, UserCheck, Loader2, Pencil, UserX, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Formulario de edición ────────────────────────────────────────────────────
const EditForm = ({ usuario, onSave, onCancel }) => {
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(usuario.id, form);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100 space-y-4">
      <p className="text-xs font-bold text-[#0070bc] uppercase tracking-widest text-center mb-2">
        ✏️ Editando: {usuario.nombre}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo</label>
          <input
            type="text"
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0070bc] focus:border-transparent outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email corporativo</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0070bc] focus:border-transparent outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
          <select
            value={form.rol}
            onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0070bc] focus:border-transparent outline-none bg-white"
          >
            <option value="viewer">Viewer — Solo lectura</option>
            <option value="admin">Admin — Acceso estandar</option>
            <option value="superadministrador">Superadministrador — Acceso total</option>
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
                form.activo ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                form.activo ? 'translate-x-8' : 'translate-x-1'
              }`} />
            </button>
            <span className={`text-sm font-semibold ${form.activo ? 'text-green-700' : 'text-gray-400'}`}>
              {form.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-xs font-medium flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 bg-[#0070bc] hover:bg-blue-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold px-4 py-2 rounded-xl transition"
        >
          <X className="w-4 h-4" /> Cancelar
        </button>
      </div>
    </form>
  );
};

// ─── Formulario para crear usuario nuevo ─────────────────────────────────────
const NuevoUsuarioForm = ({ onCrear, onCancel }) => {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'viewer' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onCrear(form);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-green-50/60 border border-green-100 rounded-2xl p-5 space-y-4">
      <p className="text-xs font-bold text-green-700 uppercase tracking-widest text-center">
        ➕ Nuevo usuario
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo</label>
          <input type="text" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 outline-none" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 outline-none" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Contraseña inicial</label>
          <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 outline-none" required minLength={6} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
          <select value={form.rol} onChange={e => setForm(f => ({...f, rol: e.target.value}))}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-green-400 outline-none">
            <option value="viewer">Viewer — Solo lectura</option>
            <option value="admin">Admin — Acceso estandar</option>
            <option value="superadministrador">Superadministrador — Acceso total</option>
          </select>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {saving ? 'Creando...' : 'Crear usuario'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold px-4 py-2 rounded-xl transition">
          <X className="w-4 h-4" /> Cancelar
        </button>
      </div>
    </form>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────
export const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editando, setEditando] = useState(null);     // ID en modo edición
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null); // fila con acciones expandidas

  useEffect(() => { fetchUsuarios(); }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const res = await usuariosAPI.listar();
      setUsuarios(res.data);
    } catch {
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  const notify = (msg, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); }
  };

  const handleEditar = async (id, data) => {
    await usuariosAPI.actualizar(id, data);
    notify('✅ Usuario actualizado correctamente');
    setEditando(null);
    fetchUsuarios();
  };

  const handleCrear = async (data) => {
    await usuariosAPI.crear(data);
    notify('✅ Usuario creado correctamente');
    setMostrarNuevo(false);
    fetchUsuarios();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#0070bc]" />
    </div>
  );

  return (
    <div className="space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0070bc] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-800">Gestión de Usuarios</h1>
            <p className="text-sm text-gray-500">Crea, edita y administra los usuarios del sistema.</p>
          </div>
        </div>
        <button
          onClick={() => { setMostrarNuevo(v => !v); setEditando(null); }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium">
          <Check className="w-4 h-4 flex-shrink-0" /> {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Formulario nuevo usuario */}
      {mostrarNuevo && (
        <NuevoUsuarioForm onCrear={handleCrear} onCancel={() => setMostrarNuevo(false)} />
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Usuario</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Email</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Rol</th>
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Estado</th>
                <th className="text-right text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuarios.map((u) => (
                <>
                  <tr key={u.id} className={`hover:bg-gray-50/60 transition ${!u.activo ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0070bc] to-blue-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {u.nombre?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800 text-sm">{u.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                        u.rol === 'superadministrador' ? 'bg-red-100 text-red-700' :
                        u.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>{u.rol}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1 text-xs font-medium ${u.activo ? 'text-green-600' : 'text-red-500'}`}>
                        {u.activo ? <><UserCheck className="w-3.5 h-3.5" />Activo</> : <><UserX className="w-3.5 h-3.5" />Inactivo</>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          const next = expandedRow === u.id ? null : u.id;
                          setExpandedRow(next);
                          setEditando(null);
                        }}
                        className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-lg transition"
                      >
                        Gestionar
                        {expandedRow === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>

                  {/* Fila expandida con acciones */}
                  {expandedRow === u.id && (
                    <tr key={`exp-${u.id}`}>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50/80 border-b border-gray-100">
                        <div className="space-y-4">
                          {/* Botones de acción */}
                          {editando !== u.id && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setEditando(u.id)}
                                className="flex items-center gap-1.5 bg-[#0070bc] hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Editar datos
                              </button>
                            </div>
                          )}

                          {/* Formulario edición */}
                          {editando === u.id && (
                            <EditForm
                              usuario={u}
                              onSave={handleEditar}
                              onCancel={() => setEditando(null)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {usuarios.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No hay usuarios registrados.</div>
          )}
        </div>
      </div>
    </div>
  );
};
