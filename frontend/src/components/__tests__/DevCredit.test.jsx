import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DevCredit } from '../DevCredit';
import { Layout } from '../Layout';

vi.mock('../Navbar', () => ({ Navbar: () => null }));
vi.mock('../AgentChat', () => ({ AgentChat: () => null }));

describe('DevCredit', () => {
  test('muestra "Dev by" y el monograma EDC accesible', () => {
    render(<DevCredit />);
    expect(screen.getByText('Dev by')).toBeInTheDocument();
    const mono = screen.getByRole('img', { name: 'Emilio Droguett Cabezas' });
    expect(mono.getAttribute('viewBox')).toBe('-4 -4 746 241');
    expect(mono.getAttribute('fill')).toBe('currentColor');
  });

  test('el Layout común incluye el crédito en todas las rutas autenticadas', () => {
    render(<Layout onLogout={() => {}}><p>contenido</p></Layout>);
    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Emilio Droguett Cabezas' })).toBeInTheDocument();
  });
});
