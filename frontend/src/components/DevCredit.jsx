// Crédito del desarrollador: "Dev by" + monograma EDC (SVG inline).
// Discreto (11px, gris apagado) y reutilizable en cualquier pantalla.

const NOMBRE = 'Emilio Droguett Cabezas';

export const EdcMonogram = ({ className = '', style }) => (
  <svg
    viewBox="-4 -4 746 241"
    fill="currentColor"
    role="img"
    aria-label={NOMBRE}
    className={className}
    style={{ height: 11, width: 'auto', aspectRatio: '746 / 241', ...style }}
  >
    <title>{NOMBRE}</title>
    <path d="M0 0H228L211 40H0Z" />
    <path d="M0 96H228L211 136H0Z" />
    <path d="M0 193H228L211 233H0Z" />
    <path d="M262 0H392V40H245Z" />
    <path d="M388 20C468 20 532 74 497 121L470 150" fill="none" stroke="currentColor" strokeWidth="40" strokeLinejoin="round" />
    <path d="M262 193H330V233H245Z" />
    <path d="M326 213H352C402 213 425 196 455 166L540 76C575 40 600 20 650 20H662" fill="none" stroke="currentColor" strokeWidth="40" />
    <path d="M658 0H738L721 40H658Z" />
    <path d="M556 150C566 196 590 213 630 213" fill="none" stroke="currentColor" strokeWidth="40" />
    <path d="M626 193H738L721 233H626Z" />
  </svg>
);

export const DevCredit = ({ className = '' }) => (
  <div
    className={`flex items-center justify-center gap-1 text-[11px] leading-none text-gray-400 opacity-80 hover:opacity-100 transition-opacity select-none ${className}`}
    title={NOMBRE}
  >
    <span>Dev by</span>
    <EdcMonogram />
  </div>
);
