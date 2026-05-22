import { useState } from 'react';

export const DuplicadosAlert = ({ duplicados, navigate }) => {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState({ imeis: false, sims: false, telefonos: false });

  if (dismissed) return null;

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const total =
    (duplicados.imeis?.length || 0) +
    (duplicados.sims?.length || 0) +
    (duplicados.telefonos?.length || 0);

  const Section = ({ sectionKey, label, items, valueKey, searchLabel }) => {
    if (!items?.length) return null;
    const open = expanded[sectionKey];
    return (
      <div className="border-t border-red-100 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
        <button
          onClick={() => toggle(sectionKey)}
          className="flex items-center justify-between w-full text-left group"
        >
          <span className="text-sm font-semibold text-red-800 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black">
              {items.length}
            </span>
            {label} {items.length === 1 ? 'duplicado' : 'duplicados'}
          </span>
          <span className={`text-red-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {open && (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item, i) => {
              const val = item[valueKey];
              return (
                <button
                  key={i}
                  onClick={() => navigate('/activos', { state: { busqueda: val } })}
                  title={`Ver los ${item.cantidad} activos con ${searchLabel}: ${val}`}
                  className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-400 transition-all group/chip"
                >
                  <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>{val}</span>
                  <span className="text-red-400 group-hover/chip:text-red-600 font-normal">×{item.cantidad}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-100 border-b border-red-200">
        <div className="flex items-center gap-2.5">
          <svg className="h-4 w-4 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-bold text-red-900">
            Alerta de Integridad — {total} tipo{total > 1 ? 's' : ''} de duplicado{total > 1 ? 's' : ''} detectado{total > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-red-500 font-medium">· Haz click en un valor para ver los activos</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-400 hover:text-red-700 transition ml-2 flex-shrink-0"
          title="Descartar alerta (esta sesión)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Secciones expandibles */}
      <div className="px-4 py-3 space-y-0">
        <Section
          sectionKey="imeis"
          label="IMEI"
          items={duplicados.imeis}
          valueKey="imei"
          searchLabel="IMEI"
        />
        <Section
          sectionKey="sims"
          label="SIM (ICCID)"
          items={duplicados.sims}
          valueKey="numero_sim"
          searchLabel="SIM"
        />
        <Section
          sectionKey="telefonos"
          label="Teléfono"
          items={duplicados.telefonos}
          valueKey="numero_telefono"
          searchLabel="teléfono"
        />
      </div>
    </div>
  );
};
