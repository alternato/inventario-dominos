const xlsx = require('xlsx');
const db = require('./db');

// Función de limpieza y normalización de textos
const normalizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Quitar espacios y símbolos
};

// Diccionario de mapeo de cabeceras (fuzzy matching)
// Clave: campo de base de datos
// Valor: array de posibles nombres de columna (normalizados y crudos)
const headerMap = {
  serie: ['serie', 'nserie', 'numerodeserie', 'sn', 'serialnumber', 'n°serie', 'serial'],
  marca: ['marca', 'brand', 'fabricante'],
  modelo: ['modelo', 'model'],
  estado: ['estado', 'status', 'condicion'],
  tipo_dispositivo: ['tipo', 'tipodispositivo', 'type', 'device', 'tipodeequipo', 'equipo', 'categoria'],
  rut_responsable: ['rut', 'rutresponsable', 'responsable', 'usuario', 'rutusuario', 'rutcolaborador', 'asignadoa'],
  ubicacion: ['ubicacion', 'location', 'lugar', 'sede', 'tienda', 'sucursal'],
  observaciones: ['observaciones', 'observacion', 'notas', 'notes', 'comentarios'],
  fecha_compra: ['fechadecompra', 'fechacompra', 'compra', 'adquisicion', 'date'],
  valor: ['valor', 'precio', 'costo', 'cost', 'price'],
  numero_factura: ['factura', 'numerodefactura', 'numerofactura', 'nfactura', 'invoice'],
  imei: ['imei', 'nimei', 'numeroimei'],
  numero_sim: ['numerosim', 'sim', 'telefono', 'celular', 'numerocelular', 'linea'],
  imsi: ['imsi', 'nimsi']
};

const mapHeaders = (headers) => {
  const mapped = {}; // indice_columna_original -> campo_db
  headers.forEach((header, index) => {
    if (!header) return;
    const normalizedHeader = normalizeString(header);
    
    let matchedField = null;
    for (const [dbField, variations] of Object.entries(headerMap)) {
      if (variations.includes(normalizedHeader) || variations.some(v => normalizedHeader.includes(v))) {
        matchedField = dbField;
        break;
      }
    }
    
    if (matchedField) {
      mapped[header] = matchedField;
    }
  });
  return mapped;
};

const getDefaultValue = (field, dbField) => {
  if (dbField === 'estado') {
    const norm = normalizeString(field);
    if (norm.includes('asignado')) return 'Asignado';
    if (norm.includes('disponible')) return 'Disponible';
    if (norm.includes('mantenimiento')) return 'Mantenimiento';
    if (norm.includes('descartado') || norm.includes('baja')) return 'Descartado';
    return 'Disponible'; // Default
  }
  if (dbField === 'tipo_dispositivo') {
    const norm = normalizeString(field);
    if (norm.includes('laptop') || norm.includes('notebook')) return 'Laptop';
    if (norm.includes('desktop') || norm.includes('pc')) return 'Desktop';
    if (norm.includes('smartphone') || norm.includes('telefono') || norm.includes('celular')) return 'Smartphone';
    if (norm.includes('tablet')) return 'Tablet';
    if (norm.includes('sim')) return 'SIM Card';
    if (norm.includes('impresora')) return 'Impresora';
    if (norm.includes('monitor')) return 'Monitor';
    if (norm.includes('servidor')) return 'Servidor';
    return 'Otro'; // Default
  }
  return field;
};

const parseDateFromExcel = (excelDate) => {
  if (!excelDate) return null;
  // Si ya es un formato Date de string o ISO
  if (typeof excelDate === 'string') {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return null;
  }
  // Si es número de serie de fecha de Excel
  if (typeof excelDate === 'number') {
    const d = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Excel usa época de 1900
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
};

const previewImportRows = async (dataRows) => {
  const results = {
    totalLeidos: dataRows.length,
    duplicadosActivos: [], // {serie, marca}
    nuevosActivos: [],     // {serie, marca}
    duplicadosUsuarios: [], // {rut}
    nuevosUsuarios: []      // {rut}
  };

  const procesarRuts = new Set();
  
  for (const row of dataRows) {
    if (!row.serie) continue;

    // Detectar Activo
    const activoExistente = await db.getActivoBySerie(row.serie);
    if (activoExistente) {
      results.duplicadosActivos.push({ serie: row.serie, marca: row.marca || activoExistente.marca || 'Desconocida' });
    } else {
      results.nuevosActivos.push({ serie: row.serie, marca: row.marca || 'No definida' });
    }

    // Detectar Colaborador (RUT)
    if (row.rut_responsable) {
      const rut = row.rut_responsable.replace(/[^0-9kK-]/g, '').toUpperCase();
      if (!procesarRuts.has(rut)) {
        procesarRuts.add(rut);
        const colaborador = await db.getColaboradorByRut(rut);
        if (colaborador) {
          results.duplicadosUsuarios.push({ rut });
        } else {
          results.nuevosUsuarios.push({ rut, nombre: row.responsable_nombre || 'Desconocido' });
        }
      }
    }
  }

  return results;
};

const processImportRows = async (dataRows, usuarioId) => {
  const results = {
    totalLeidos: dataRows.length,
    creados: 0,
    actualizados: 0,
    colaboradoresCreados: 0,
    errores: [],
    omitidos: 0
  };

  for (let i = 0; i < dataRows.length; i++) {
      const row = Object.assign({}, dataRows[i]); // Copia segura
      try {
          if (!row.serie) {
               results.errores.push(`Fila ${i+2}: Falta 'serie'. Omitido.`);
               results.omitidos++;
               continue;
          }
          if (!row.marca) row.marca = 'Genérica';
          if (!row.modelo) row.modelo = 'Desconocido';
          if (!row.estado) row.estado = 'Disponible';
          if (!row.tipo_dispositivo) row.tipo_dispositivo = 'Otro';

          if (row.rut_responsable) {
              const rut = row.rut_responsable.replace(/[^0-9kK-]/g, '').toUpperCase();
              row.rut_responsable = rut; 
              let colaborador = await db.getColaboradorByRut(rut);
              if (!colaborador) {
                  colaborador = await db.createColaborador({
                      rut: rut,
                      nombre: row.responsable_nombre || 'Usuario sin nombre (Auto-creado)',
                      area: 'Otro'
                  });
                  results.colaboradoresCreados++;
              }
          }

          const activoExistente = await db.getActivoBySerie(row.serie);
          if (activoExistente) {
              const payload = { ...activoExistente, ...row };
              await db.updateActivo(row.serie, payload, usuarioId);
              results.actualizados++;
          } else {
              await db.createActivo(row, usuarioId);
              results.creados++;
          }
      } catch (err) {
          results.errores.push(`Fila ${i+2} (Serie ${row.serie || '?'}) : ${err.message}`);
          results.omitidos++;
      }
  }
  return results;
};

module.exports = {
  normalizeString,
  headerMap,
  getDefaultValue,
  parseDateFromExcel,
  previewImportRows,
  processImportRows
};
