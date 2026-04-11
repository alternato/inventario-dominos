import React, { useState, useRef } from 'react';
import { activosAPI } from '../api';

const ImportDataModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    }
  };

  const handeDragOver = (e) => {
    e.preventDefault();
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await activosAPI.importar(file);
      setResult(response.data);
      if (onImportSuccess) {
        onImportSuccess(); // para refrescar tablas al recargar
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-70 backdrop-blur-sm transition-opacity">
      <div className="relative bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden ring-1 ring-white/10 flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700 bg-[#0f172a]">
          <h2 className="text-xl font-bold text-white tracking-wide">
            Carga Masiva de Datos
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido (con scroll interno si es largo) */}
        <div className="p-6 flex-1 overflow-y-auto">
          {!result && !error ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-300">
                Sube un archivo <span className="font-semibold text-blue-400">.xls</span>, <span className="font-semibold text-green-400">.xlsx</span>, <span className="font-semibold text-yellow-400">.csv</span> o <span className="font-semibold text-purple-400">.json</span>. 
                El sistema intentará mapear las columnas automáticamente (Ej: N° Serie, Marca, Modelo, Tipo, RUT). Si el activo existe se actualizará, si no, se creará.
              </p>

              <div 
                className="border-2 border-dashed border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition-colors cursor-pointer group"
                onDrop={handleDrop}
                onDragOver={handeDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-12 h-12 text-gray-400 group-hover:text-blue-400 mb-3 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {file ? (
                  <p className="text-blue-400 font-medium text-center">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                ) : (
                  <p className="text-gray-300 text-center">
                    Arrastra y suelta tu archivo aquí<br />
                    <span className="text-sm text-gray-500">o haz clic para seleccionar</span>
                  </p>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/json"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          ) : result ? (
            <div className="flex flex-col gap-4">
              <div className="bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-start gap-4">
                <svg className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h4 className="text-green-400 font-bold mb-1">¡Importación completada!</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>Filas reconocidas: <strong>{result.totalLeidos}</strong></li>
                    <li>Activos creados: <strong>{result.creados}</strong></li>
                    <li>Activos actualizados: <strong>{result.actualizados}</strong></li>
                    <li>Colaboradores creados (auto): <strong>{result.colaboradoresCreados}</strong></li>
                    {result.omitidos > 0 && <li className="text-yellow-400">Filas omitidas (error): <strong>{result.omitidos}</strong></li>}
                  </ul>
                </div>
              </div>

              {result.errores && result.errores.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mt-2 max-h-48 overflow-y-auto">
                  <h4 className="text-red-400 font-semibold mb-2 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Detalle de Errores ({result.errores.length})
                  </h4>
                  <ul className="text-xs text-red-200/80 space-y-1 list-disc list-inside">
                    {result.errores.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-4">
                <svg className="w-8 h-8 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-red-200">
                  <h4 className="font-bold text-red-400 mb-1">Fallo en la importación</h4>
                  <p>{error}</p>
                </div>
              </div>
              <button 
                onClick={resetForm}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors self-start underline underline-offset-2"
              >
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-700 bg-gray-800/50 gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 transition-colors font-medium text-sm"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result && !error && (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </>
              ) : (
                'Procesar Archivo'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDataModal;
