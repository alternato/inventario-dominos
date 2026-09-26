import { useRef } from 'react';
import { Check } from 'lucide-react';

/**
 * Stepper: indicador de progreso para flujos multi-paso (asignación, devolución).
 * Requisitos: 4.5, 15.4 — pasos numerados secuencialmente desde 1, paso actual
 * indicado de forma visible, navegable por teclado.
 *
 * Accesibilidad:
 * - El contenedor expone role="group" / aria-label describiendo el flujo.
 * - Cada paso es un botón con aria-current="step" cuando es el paso actual.
 * - Navegación por teclado: flechas izquierda/derecha (y arriba/abajo) mueven el
 *   foco entre pasos; Home/End saltan al primero/último. Tab entra y sale del grupo.
 * - Los pasos completados muestran un check; los futuros se muestran atenuados.
 *
 * @param {Array<{ label: string, description?: string }>} steps - Definición de pasos (>=1).
 * @param {number} currentStep - Índice del paso actual (0-based). Se muestra numerado desde 1.
 * @param {(index: number) => void} [onStepClick] - Callback opcional al seleccionar un paso.
 * @param {boolean} [clickable=false] - Si es true, permite navegar a pasos ya alcanzados.
 * @param {string} [ariaLabel='Progreso del flujo'] - Etiqueta accesible del grupo.
 * @param {string} [className] - Clases Tailwind adicionales para el contenedor.
 */
export const Stepper = ({
  steps = [],
  currentStep = 0,
  onStepClick,
  clickable = false,
  ariaLabel = 'Progreso del flujo',
  className = '',
}) => {
  const stepRefs = useRef([]);

  if (!Array.isArray(steps) || steps.length === 0) return null;

  const focusStep = (index) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    stepRefs.current[clamped]?.focus();
  };

  const handleKeyDown = (e, index) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        focusStep(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        focusStep(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusStep(0);
        break;
      case 'End':
        e.preventDefault();
        focusStep(steps.length - 1);
        break;
      default:
        break;
    }
  };

  const isSelectable = (index) => clickable && index <= currentStep && !!onStepClick;

  return (
    <ol
      role="group"
      aria-label={ariaLabel}
      className={`flex items-center w-full ${className}`}
    >
      {steps.map((step, index) => {
        const number = index + 1;
        const isCurrent = index === currentStep;
        const isCompleted = index < currentStep;
        const selectable = isSelectable(index);

        const circleBase =
          'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 transition-colors shrink-0';
        const circleState = isCompleted
          ? 'bg-primary border-primary text-white'
          : isCurrent
            ? 'bg-white border-primary text-primary ring-2 ring-primary/30'
            : 'bg-white border-gray-300 text-gray-400';

        return (
          <li
            key={step.label ?? index}
            className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
          >
            <button
              type="button"
              ref={(el) => { stepRefs.current[index] = el; }}
              onClick={selectable ? () => onStepClick(index) : undefined}
              onKeyDown={(e) => handleKeyDown(e, index)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`Paso ${number} de ${steps.length}: ${step.label}${isCompleted ? ' (completado)' : ''}${isCurrent ? ' (actual)' : ''}`}
              disabled={!selectable}
              tabIndex={isCurrent ? 0 : -1}
              className={`flex items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectable ? 'cursor-pointer' : 'cursor-default'} disabled:cursor-default`}
            >
              <span className={`${circleBase} ${circleState}`} aria-hidden="true">
                {isCompleted ? <Check className="w-4 h-4" /> : number}
              </span>
              <span
                className={`hidden sm:block text-sm font-medium ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </button>

            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`flex-1 h-0.5 mx-2 rounded ${index < currentStep ? 'bg-primary' : 'bg-gray-200'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default Stepper;
