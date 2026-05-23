import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import apiClient from '../api';

const mdComponents = {
  p:      ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul:     ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
  ol:     ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
  li:     ({ children }) => <li className="leading-snug">{children}</li>,
  code:   ({ inline, children }) => inline
    ? <code className="bg-black/10 rounded px-1 font-mono text-xs">{children}</code>
    : <pre className="bg-black/10 rounded p-2 my-1 overflow-x-auto font-mono text-xs whitespace-pre-wrap"><code>{children}</code></pre>,
  h3:     ({ children }) => <p className="font-semibold mt-1.5 mb-0.5">{children}</p>,
  h4:     ({ children }) => <p className="font-medium mt-1 mb-0.5">{children}</p>,
};

const SUGERENCIAS = [
  'Muéstrame cuántos equipos hay por tipo',
  'Busca todos los equipos categorizados como Otro',
  'Recategoriza los equipos en Otro según su marca y modelo',
  '¿Qué equipos están en mantenimiento?',
];

export const AgentChat = () => {
  const [abierto,   setAbierto]   = useState(false);
  const [mensajes,  setMensajes]  = useState([]);
  const [input,     setInput]     = useState('');
  const [cargando,  setCargando]  = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Scroll automático al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  // Foco en input al abrir
  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 100);
  }, [abierto]);

  const enviar = async (texto) => {
    const msg = texto || input.trim();
    if (!msg || cargando) return;
    setInput('');

    const nuevosMensajes = [
      ...mensajes,
      { role: 'user', content: msg },
    ];
    setMensajes(nuevosMensajes);
    setCargando(true);

    try {
      const { data } = await apiClient.post('/chat', {
        mensajes: nuevosMensajes,
      });
      setMensajes(data.historial.filter(m => m.role === 'user' || (m.role === 'assistant' && m.content.some?.(b => b.type === 'text') || typeof m.content === 'string')));
      // Normalizamos: guardamos historial completo para contexto, pero mostramos solo texto
      setMensajes(prev => {
        const visibles = data.historial.flatMap(m => {
          if (m.role === 'user') {
            const texto = Array.isArray(m.content)
              ? m.content.find(b => b.type === 'text')?.text
              : m.content;
            return texto ? [{ role: 'user', content: texto, _raw: m }] : [];
          }
          if (m.role === 'assistant') {
            const texto = Array.isArray(m.content)
              ? m.content.find(b => b.type === 'text')?.text
              : m.content;
            return texto ? [{ role: 'assistant', content: texto, _raw: m }] : [];
          }
          return [];
        });
        return visibles;
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al contactar al agente.';
      setMensajes(prev => [...prev, { role: 'assistant', content: `❌ ${errorMsg}` }]);
    } finally {
      setCargando(false);
    }
  };

  const limpiar = () => setMensajes([]);

  const historialParaAPI = () =>
    mensajes.map(m => m._raw || { role: m.role, content: m.content });

  const enviarConHistorial = async (texto) => {
    const msg = texto || input.trim();
    if (!msg || cargando) return;
    setInput('');

    const mensajesVisibles = [...mensajes, { role: 'user', content: msg }];
    setMensajes(mensajesVisibles);
    setCargando(true);

    const payload = [
      ...historialParaAPI(),
      { role: 'user', content: msg },
    ];

    try {
      const { data } = await apiClient.post('/chat', { mensajes: payload });

      const visibles = data.historial.flatMap(m => {
        if (m.role === 'user') {
          const t = Array.isArray(m.content)
            ? m.content.find(b => b.type === 'text')?.text
            : m.content;
          return t ? [{ role: 'user', content: t, _raw: m }] : [];
        }
        if (m.role === 'assistant') {
          const t = Array.isArray(m.content)
            ? m.content.find(b => b.type === 'text')?.text
            : m.content;
          return t ? [{ role: 'assistant', content: t, _raw: m }] : [];
        }
        return [];
      });
      setMensajes(visibles);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al contactar al agente.';
      setMensajes(prev => [...prev, { role: 'assistant', content: `❌ ${errorMsg}` }]);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      {/* ── Botón flotante ── */}
      <button
        onClick={() => setAbierto(!abierto)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          abierto ? 'bg-gray-700 hover:bg-gray-800' : 'bg-[#0066CC] hover:bg-blue-700'
        }`}
        title="Asistente IA"
      >
        {abierto
          ? <X className="w-6 h-6 text-white" />
          : <MessageSquare className="w-6 h-6 text-white" />
        }
      </button>

      {/* ── Ventana de chat ── */}
      {abierto && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="bg-[#0066CC] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Asistente IT</p>
                <p className="text-blue-200 text-xs">Inventario Domino&apos;s</p>
              </div>
            </div>
            {mensajes.length > 0 && (
              <button
                onClick={limpiar}
                className="text-blue-200 hover:text-white transition p-1 rounded"
                title="Limpiar conversación"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <Bot className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500 mb-1">¿En qué te ayudo?</p>
                <p className="text-xs text-gray-400 mb-4">Puedo consultar, recategorizar y actualizar equipos</p>
                <div className="w-full space-y-2">
                  {SUGERENCIAS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => enviarConHistorial(s)}
                      className="w-full text-left text-xs text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg px-3 py-2 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              mensajes.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 bg-[#0066CC] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#0066CC] text-white rounded-tr-sm whitespace-pre-wrap'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}
                  >
                    {m.role === 'assistant'
                      ? <ReactMarkdown components={mdComponents}>{m.content}</ReactMarkdown>
                      : m.content
                    }
                  </div>
                  {m.role === 'user' && (
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                  )}
                </div>
              ))
            )}

            {cargando && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 bg-[#0066CC] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  <span className="text-xs text-gray-400">Pensando...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    enviarConHistorial();
                  }
                }}
                placeholder="Escribe una tarea o pregunta..."
                rows={1}
                className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent text-gray-700 placeholder-gray-400"
                style={{ maxHeight: '100px' }}
              />
              <button
                onClick={() => enviarConHistorial()}
                disabled={!input.trim() || cargando}
                className="w-9 h-9 bg-[#0066CC] hover:bg-blue-700 disabled:bg-gray-200 rounded-xl flex items-center justify-center transition flex-shrink-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Enter para enviar · Shift+Enter para nueva línea
            </p>
          </div>
        </div>
      )}
    </>
  );
};
