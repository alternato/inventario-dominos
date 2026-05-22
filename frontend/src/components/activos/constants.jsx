import { Laptop, Smartphone, Wifi, HardDrive, Package } from 'lucide-react';

export const ESTADOS = ['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'];

export const ESTADO_STYLE = {
  Asignado:      { pill: 'bg-emerald-100 text-emerald-800 border border-emerald-200', dot: 'bg-emerald-500' },
  Disponible:    { pill: 'bg-amber-100   text-amber-800   border border-amber-200',   dot: 'bg-amber-400'   },
  Mantenimiento: { pill: 'bg-red-100     text-red-800     border border-red-200',     dot: 'bg-red-500'     },
  Descartado:    { pill: 'bg-gray-100    text-gray-600    border border-gray-200',    dot: 'bg-gray-400'    },
};

const TIPO_ICON = {
  Laptop:     <Laptop className="w-4 h-4" />,
  Smartphone: <Smartphone className="w-4 h-4" />,
  'SIM Card': <Wifi className="w-4 h-4" />,
  Desktop:    <HardDrive className="w-4 h-4" />,
};

const TIPO_COLOR = {
  Laptop:     'bg-blue-50   text-blue-600',
  Smartphone: 'bg-purple-50 text-purple-600',
  'SIM Card': 'bg-teal-50   text-teal-600',
  Desktop:    'bg-sky-50    text-sky-600',
};

export function getTipoIcon(tipo) {
  return TIPO_ICON[tipo] ?? <Package className="w-4 h-4" />;
}

export function getTipoColor(tipo) {
  return TIPO_COLOR[tipo] ?? 'bg-gray-50 text-gray-500';
}
