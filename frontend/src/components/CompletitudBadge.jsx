import { AlertTriangle } from 'lucide-react';

/**
 * CompletitudBadge: indicador visual de advertencia para un Campo_Recomendado vacío.
 * Requisitos: 1.3, 2.3 — badge de campo incompleto con ícono de advertencia,
 * color de alerta y texto accesible.
 *
 * Uso típico junto a un campo recomendado sin valor. Es accesible:
 * expone role="status" y un aria-label descriptivo que nombra el campo faltante.
 *
 * @param {string} [campo] - Nombre del campo recomendado incompleto (para el aria-label).
 * @param {string} [texto] - Texto visible del badge. Por defecto "Campo recomendado incompleto".
 * @param {string} [className] - Clases Tailwind adicionales.
 */
export const CompletitudBadge = ({
  campo,
  texto = 'Campo recomendado incompleto',
  className = '',
}) => {
  const etiqueta = campo
    ? `Advertencia: el campo recomendado "${campo}" está incompleto`
    : texto;

  return (
    <span
      role="status"
      aria-label={etiqueta}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {texto}
    </span>
  );
};

export default CompletitudBadge;
