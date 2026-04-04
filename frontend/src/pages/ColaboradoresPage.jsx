import { Users } from 'lucide-react';

export const ColaboradoresPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Colaboradores</h1>
        <p className="text-gray-600">Gestión del personal de Domino's</p>
      </div>

      <div className="bg-white rounded-lg p-12 shadow text-center">
        <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Página en desarrollo</p>
        <p className="text-gray-500 text-sm mt-2">Esta funcionalidad estará disponible pronto</p>
      </div>
    </div>
  );
};
