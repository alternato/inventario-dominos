import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, LogIn } from 'lucide-react';

const loginSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .refine(
      (email) => email.endsWith('@dominospizza.cl'),
      'Solo emails corporativos @dominospizza.cl permitidos'
    ),
  password: z.string().min(6, 'Contraseña debe tener mínimo 6 caracteres'),
});

export const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    const success = await login(data.email, data.password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">TI Maestro</h1>
          <p className="text-gray-600">Domino's Pizza Chile</p>
          <p className="text-sm text-gray-500 mt-2">Gestión de Inventario</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="inline w-4 h-4 mr-1" />
              Email Corporativo
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="usuario@dominospizza.cl"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="inline w-4 h-4 mr-1" />
              Contraseña
            </label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Error general */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Botón submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Credenciales de prueba:</p>
          <p className="font-mono bg-gray-100 p-2 rounded mt-2 text-xs">
            admin@dominospizza.cl
          </p>
        </div>

        <div className="mt-4 text-center">
          <a href="#forgot" className="text-primary hover:underline text-sm">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    </div>
  );
};
