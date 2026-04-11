import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { activosAPI } from '../api';

const DB_FIELDS = [
  { value: '', label: '-- Ignorar/No Mapear --' },
  { value: 'serie', label: 'N° Serie (Requerido)', required: true },
  { value: 'marca', label: 'Marca' },
  { value: 'modelo', label: 'Modelo' },
  { value: 'estado', label: 'Estado' },
  { value: 'tipo_dispositivo', label: 'Tipo Dispositivo' },
  { value: 'rut_responsable', label: 'RUT Responsable (Para vincular)' },
  { value: 'responsable_nombre', label: 'Nombre Responsable (Si se crea RUT)' },
  { value: 'ubicacion', label: 'Ubicación' },
  { value: 'observaciones', label: 'Observaciones' },
  { value: 'fecha_compra', label: 'Fecha Compra' },
  { value: 'valor', label: 'Valor/Precio' },
  { value: 'numero_factura', label: 'N° Factura' },
  { value: 'imei', label: 'IMEI' },
  { value: 'numero_sim', label: 'Número SIM' },
  { value: 'imsi', label: 'IMSI' },
];

const normalizeStr = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const AUTO_MAP = {
  serie: ['serie', 'nserie', 'numerodeserie', 'sn', 'serialnumber', 'n°serie', 'serial'],
  marca: ['marca', 'brand', 'fabricante'],
  modelo: ['modelo', 'model'],
  estado: ['estado', 'status', 'condicion'],
  tipo_dispositivo: ['tipo', 'tipodispositivo', 'type', 'device', 'tipodeequipo', 'equipo', 'categoria'],
  rut_responsable: ['rut', 'rutresponsable', 'responsable', 'usuario', 'rutusuario', 'rutcolaborador', 'asignadoa'],
  responsable_nombre: ['nombre', 'nombreresponsable', 'nombreusuario'],
  ubicacion: ['ubicacion', 'location', 'lugar', 'sede', 'tienda', 'sucursal'],
  observaciones: ['observaciones', 'observacion', 'notas', 'notes', 'comentarios'],
  fecha_compra: ['fechadecompra', 'fechacompra', 'compra', 'adquisicion', 'date'],
  valor: ['valor', 'precio', 'costo', 'cost', 'price'],
  numero_factura: ['factura', 'numerodefactura', 'numerofactura', 'nfactura', 'invoice'],
  imei: ['imei', 'nimei', 'numeroimei'],
  numero_sim: ['numerosim', 'sim', 'telefono', 'celular', 'numerocelular', 'linea'],
  imsi: ['imsi', 'nimsi']
};

const guessHeader = (header) => {
  const norm = normalizeStr(header);
  for (const [dbField, variations] of Object.entries(AUTO_MAP)) {
    if (variations.some(v => norm.includes(v))) return dbField;
  }
  return '';
};

const ImportDataModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [step, setStep] = useState(1); // 1: Select, 2: Map, 3: Preview, 4: Result
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState([]);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep(1);
    setFileName('');
    setRawData([]);
    setFileHeaders([]);
    setMapping({});
    setPreviewData(null);
    setCommitResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const processFileFile = (f) => {
    setFileName(f.name);
    setError(null);
    setLoading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        let pData = [];
        if (f.name.endsWith('.json')) {
          pData = JSON.parse(data);
        } else {
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          pData = XLSX.utils.sheet_to_json(firstSheet, { defval: null });
        }

        if (!pData || pData.length === 0) throw new Error("El archivo está vacío");

        const headers = Object.keys(pData[0]);
        setFileHeaders(headers);
        setRawData(pData);

        const initialMapping = {};
        headers.forEach(h => {
          initialMapping[h] = guessHeader(h);
        });
        setMapping(initialMapping);
        setStep(2);

      } catch (err) {
        setError('No se pudo procesar el archivo: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Problemas leyendo el archivo');
      setLoading(false);
    };

    if (f.name.endsWith('.json')) reader.readAsText(f);
    else reader.readAsBinaryString(f);
  };

  const mapRows = () => {
    return rawData.map(row => {
      const newRow = {};
      Object.entries(row).forEach(([origKey, val]) => {
        const dbField = mapping[origKey];
        if (dbField && val !== null && val !== undefined) {
          // Flatten dates if Excel provided them
          newRow[dbField] = val instanceof Date ? val.toISOString().split('T')[0] : String(val).trim();
        }
      });
      return newRow;
    });
  };

  const requestPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = mapRows();
      if (!rows.some(r => r.serie)) throw new Error("Debes mapear al menos la columna 'N° Serie'");
      
      const res = await activosAPI.importarPreview(rows);
      setPreviewData(res.data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error revisando vista previa.');
    } finally {
      setLoading(false);
    }
  };

  const commitImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = mapRows();
      const res = await activosAPI.importarCommit(rows);
      setCommitResult(res.data);
      setStep(4);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Error final de importación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-70 backdrop-blur-sm">
      <div className="relative bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden ring-1 ring-white/10 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700 bg-[#0f172a]">
          <h2 className="text-xl font-bold text-white tracking-wide">
            Carga Masiva de Datos
            {step === 2 && <span className="text-gray-400 ml-2 text-sm font-normal">— Mapeo de Columnas</span>}
            {step === 3 && <span className="text-gray-400 ml-2 text-sm font-normal">— Vista Previa</span>}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pasos */}
        <div className="flex justify-between px-10 pt-4 pb-2 border-b border-gray-800 bg-[#1e293b]">
          {[1, 2, 3, 4].map(num => (
            <div key={num} className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${step === num ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.8)]' : step > num ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {step > num ? '✓' : num}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-4 rounded-r-lg">
              <p className="text-sm text-red-200"><strong>Error:</strong> {error}</p>
              {step > 1 && <button onClick={() => setError(null)} className="text-xs text-red-400 underline mt-2">Continuar editando</button>}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-300">
                Arrastra aquí tu archivo <span className="font-semibold text-blue-400">.xls</span>, <span className="font-semibold text-green-400">.csv</span> o <span className="font-semibold text-purple-400">.json</span>.
              </p>
              <div 
                className="border-2 border-dashed border-gray-600 rounded-xl p-10 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition-colors cursor-pointer group"
                onDrop={e => { e.preventDefault(); processFileFile(e.dataTransfer.files[0]); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                {loading ? <span className="text-blue-400 animate-pulse">Lleyendo en el navegador...</span> : (
                  <>
                    <svg className="w-12 h-12 text-gray-400 group-hover:text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-gray-300">Clic para explorar o arrastrar</p>
                  </>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/json" onChange={e => { if(e.target.files[0]) processFileFile(e.target.files[0]); }} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-300">
                Archivo: <span className="text-blue-400 font-medium">{fileName}</span> ({rawData.length} filas leídas).<br/>
                Empareja las columnas de tu archivo con los campos del sistema. Ignora las que no te sirvan.
              </p>
              <div className="border border-gray-700/50 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#0f172a] text-gray-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 font-medium">Columna en Archivo {fileName}</th>
                      <th className="px-4 py-2 font-medium">Campo en Sistema</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {fileHeaders.map((header) => (
                      <tr key={header} className="hover:bg-gray-800/30">
                        <td className="px-4 py-2 text-gray-200">
                          <code className="text-xs bg-gray-800 px-2 py-0.5 rounded text-blue-300">{header}</code>
                        </td>
                        <td className="px-4 py-2">
                          <select 
                            value={mapping[header] || ''} 
                            onChange={(e) => setMapping({...mapping, [header]: e.target.value})}
                            className="w-full bg-[#0f172a] border border-gray-600 text-gray-200 rounded px-2 py-1 outline-none focus:border-blue-500"
                          >
                            {DB_FIELDS.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && previewData && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-300">Resumen del impacto en la base de datos si apruebas la carga:</p>
              
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-center">
                  <p className="text-xs text-blue-400 uppercase tracking-wide">Nuevos</p>
                  <p className="text-2xl font-bold text-white">{previewData.nuevosActivos.length}</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-center">
                  <p className="text-xs text-yellow-400 uppercase tracking-wide">A actualizar (Docs/Sobrescribir)</p>
                  <p className="text-2xl font-bold text-white">{previewData.duplicadosActivos.length}</p>
                </div>
              </div>

              {previewData.nuevosUsuarios.length > 0 && (
                <div className="bg-purple-500/10 border-l-4 border-purple-500 p-3 rounded-r-lg">
                  <p className="text-xs font-bold text-purple-400">👥 SE CREARÁN {previewData.nuevosUsuarios.length} USUARIOS NUEVOS</p>
                  <p className="text-xs text-purple-200 mt-1 line-clamp-2">
                    {previewData.nuevosUsuarios.slice(0, 5).map(u => u.rut).join(', ')} ...
                  </p>
                </div>
              )}

              {previewData.duplicadosActivos.length > 0 && (
                <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-3 rounded-r-lg max-h-32 overflow-y-auto">
                  <p className="text-xs font-bold text-yellow-500 mb-1">⚠️ REGISTROS DUPLICADOS ENCONTRADOS ({previewData.duplicadosActivos.length})</p>
                  <p className="text-xs text-yellow-200/80 mb-2">El sistema tomará la información de tu archivo y sobrescribirá permanentemente la información actual de estos activos:</p>
                  <ul className="text-xs text-yellow-200/60 list-disc list-inside space-y-1">
                    {previewData.duplicadosActivos.slice(0, 10).map((a, i) => (
                      <li key={i}>Serie: <span className="font-bold text-yellow-300">{a.serie}</span> ({a.marca})</li>
                    ))}
                    {previewData.duplicadosActivos.length > 10 && <li>... y {previewData.duplicadosActivos.length - 10} más.</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 4 && commitResult && (
            <div className="flex flex-col gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <h4 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Operación Completada
                </h4>
                <ul className="text-sm text-gray-300 space-y-1 ml-7">
                  <li>Activos Creados: <strong>{commitResult.creados}</strong></li>
                  <li>Activos Actualizados: <strong>{commitResult.actualizados}</strong></li>
                  <li>Colaboradores (Auto-Creados): <strong>{commitResult.colaboradoresCreados}</strong></li>
                  {commitResult.omitidos > 0 && <li className="text-red-400">Filas Omitidas (Error): <strong>{commitResult.omitidos}</strong></li>}
                </ul>
              </div>

              {commitResult.errores?.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 max-h-32 overflow-y-auto mt-2">
                  <p className="text-xs font-bold text-red-500 mb-1">Registro de Errores ({commitResult.errores.length})</p>
                  <ul className="text-xs text-red-300 list-disc list-inside">
                    {commitResult.errores.map((e, i) => <li key={i} className="mb-0.5">{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center p-4 border-t border-gray-700 bg-[#0f172a]">
          <div>
            {step === 2 && <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-white transition-colors">← Volver al Archivo</button>}
            {step === 3 && <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-white transition-colors">← Editar Mapeo</button>}
          </div>
          <div className="flex gap-3">
            {step < 4 ? <button onClick={handleClose} disabled={loading} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">Cancelar</button> : <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-500 rounded-lg">Cerrar</button>}
            
            {step === 2 && (
              <button 
                onClick={requestPreview} disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Consultando...' : 'Generar Vista Previa'}
              </button>
            )}
            {step === 3 && (
              <button 
                onClick={commitImport} disabled={loading}
                className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Aplicando...' : 'Confirmar Importación'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ImportDataModal;
