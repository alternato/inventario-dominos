import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstadoBadge } from './EstadoBadge';

describe('EstadoBadge', () => {
  test.each(['Asignado', 'Disponible', 'Mantenimiento', 'Descartado'])(
    'renderiza el estado "%s"',
    (estado) => {
      render(<EstadoBadge estado={estado} />);
      expect(screen.getByText(estado)).toBeInTheDocument();
    }
  );
});
