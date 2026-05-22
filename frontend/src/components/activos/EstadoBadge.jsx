import { ESTADO_STYLE } from './constants';

export const EstadoBadge = ({ estado }) => {
  const style = ESTADO_STYLE[estado] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {estado}
    </span>
  );
};
