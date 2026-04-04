import { useEffect, useState } from 'react';
import { useActivosStore } from '../store/activosStore';
import { useAuthStore } from '../store/authStore';
import { Package, Users, Activity, TrendingUp } from 'lucide-react';

export const Dashboard = () => {
  const { activos, cargarActivos } = useActivosStore();
  const { usuario } = useAuthStore();

  useEffect(() => {
    cargarActivos();
  }, []);

  const estadisticas = {
    totalActivos: activos.length,
    asignados: activos.filter((a) => a.estado === 'Asignado').length,
    disponibles: activos.filter((a) => a.estado === 'Disponible').length,
    mantenimiento: activos.filter((a) => a.estado === 'Mantenimiento').length,
  };

  const tiposDispositivos = activos.reduce((acc, curr) => {
    acc[curr.tipo_dispositivo] = (acc[curr.tipo_dispositivo] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold">Bienvenido, {usuario?.nombre}!</h1>
        <p className="text-blue-100 mt-2">Panel de control del inventario de TI</p>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Activos"
          value={estadisticas.totalActivos}
          icon={Package}
          color="bg-blue-50 text-primary"
        />
        <StatCard
          title="Asignados"
          value={estadisticas.asignados}
          icon={Users}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Disponibles"
          value={estadisticas.disponibles}
          icon={Activity}
          color="bg-yellow-50 text-yellow-600"
        />
        <StatCard
          title="En Mantenimiento"
          value={estadisticas.mantenimiento}
          icon={TrendingUp}
          color="bg-red-50 text-red-600"
        />
      </div>

      {/* Gráfico de tipos de dispositivos */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Tipos de Dispositivos</h2>
        <div className="space-y-3">
          {Object.entries(tiposDispositivos).map(([tipo, cantidad]) => (
            <div key={tipo} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{tipo}</span>
                  <span className="text-sm font-bold text-primary">{cantidad}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{
                      width: `${(cantidad / estadisticas.totalActivos) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen por estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-6 shadow">
          <h3 className="font-bold text-gray-800 mb-4">Estado General</h3>
          <div className="space-y-3">
            <EstadoItem
              label="Asignados"
              cantidad={estadisticas.asignados}
              color="bg-green-500"
            />
            <EstadoItem
              label="Disponibles"
              cantidad={estadisticas.disponibles}
              color="bg-yellow-500"
            />
            <EstadoItem
              label="En Mantenimiento"
              cantidad={estadisticas.mantenimiento}
              color="bg-red-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow">
          <h3 className="font-bold text-gray-800 mb-4">Información Rápida</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✓ Todos los datos están sincronizados</li>
            <li>✓ Base de datos en Supabase PostgreSQL</li>
            <li>✓ Acceso seguro con autenticación JWT</li>
            <li>✓ Últimas actualizaciones en tiempo real</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white rounded-lg p-6 shadow hover:shadow-lg transition">
    <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center mb-4`}>
      <Icon className="w-6 h-6" />
    </div>
    <p className="text-gray-600 text-sm">{title}</p>
    <p className="text-3xl font-bold text-gray-800">{value}</p>
  </div>
);

const EstadoItem = ({ label, cantidad, color }) => (
  <div className="flex items-center gap-3">
    <div className={`w-3 h-3 rounded-full ${color}`} />
    <span className="text-gray-700">{label}:</span>
    <span className="font-bold text-gray-800">{cantidad}</span>
  </div>
);
