import { Plus, Upload } from 'lucide-react';

export const ActivosHeader = ({ total, filtrados, filtroEstado, isAdmin, onNuevo, onImportar }) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold text-gray-800">Activos</h1>
      <p className="text-gray-500 text-sm mt-0.5">
        {filtrados} de {total} equipos
        {filtroEstado && <span className="ml-1 text-primary font-medium">· {filtroEstado}</span>}
      </p>
    </div>

    {isAdmin && (
      <div className="flex gap-2">
        <button
          onClick={onImportar}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm"
        >
          <Upload className="w-4 h-4" />
          Importar
        </button>
        <button
          onClick={onNuevo}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Activo
        </button>
      </div>
    )}
  </div>
);
