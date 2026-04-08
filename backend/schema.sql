-- ============================================================
-- SCHEMA COMPLETO - INVENTARIO DOMINO'S
-- PostgreSQL auto-hospedado (migrado desde Supabase)
-- ============================================================

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (rol IN ('admin', 'viewer', 'superadministrador')),
  activo BOOLEAN DEFAULT true,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- ============================================================
-- TABLA: colaboradores
-- ============================================================
CREATE TABLE IF NOT EXISTS colaboradores (
  id SERIAL PRIMARY KEY,
  rut VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  correo VARCHAR(255),
  area VARCHAR(100) NOT NULL CHECK (area IN ('Operaciones', 'Administración', 'Logística', 'TI', 'RRHH', 'Otro')),
  cargo VARCHAR(255),
  telefono VARCHAR(20),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_rut ON colaboradores(rut);
CREATE INDEX IF NOT EXISTS idx_colaboradores_area ON colaboradores(area);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nombre ON colaboradores(nombre);

-- ============================================================
-- TABLA: activos
-- ============================================================
CREATE TABLE IF NOT EXISTS activos (
  id SERIAL PRIMARY KEY,
  serie VARCHAR(100) UNIQUE NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  estado VARCHAR(50) NOT NULL CHECK (estado IN ('Asignado', 'Disponible', 'Mantenimiento', 'Descartado')),
  tipo_dispositivo VARCHAR(100) NOT NULL CHECK (tipo_dispositivo IN ('Laptop', 'Desktop', 'Smartphone', 'Tablet', 'SIM Card', 'Impresora', 'Otro')),
  rut_responsable VARCHAR(50) REFERENCES colaboradores(rut) ON DELETE SET NULL,
  ubicacion VARCHAR(255),
  observaciones TEXT,
  fecha_compra DATE,
  valor DECIMAL(12, 2),
  numero_factura VARCHAR(100),
  -- Campos nuevos para teléfonos y SIM
  imei VARCHAR(20),
  numero_sim VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activos_serie ON activos(serie);
CREATE INDEX IF NOT EXISTS idx_activos_estado ON activos(estado);
CREATE INDEX IF NOT EXISTS idx_activos_tipo ON activos(tipo_dispositivo);
CREATE INDEX IF NOT EXISTS idx_activos_rut ON activos(rut_responsable);
CREATE INDEX IF NOT EXISTS idx_activos_imei ON activos(imei);

-- ============================================================
-- TABLA: historial_activos  ← NUEVA
-- Trazabilidad de movimientos de equipos
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_activos (
  id SERIAL PRIMARY KEY,
  serie VARCHAR(100) NOT NULL,
  rut_anterior VARCHAR(50),
  rut_nuevo VARCHAR(50),
  estado_anterior VARCHAR(50),
  estado_nuevo VARCHAR(50),
  tipo_movimiento VARCHAR(50) NOT NULL CHECK (
    tipo_movimiento IN ('asignacion', 'devolucion', 'cambio_estado', 'creacion', 'baja', 'reparacion')
  ),
  notas TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_serie ON historial_activos(serie);
CREATE INDEX IF NOT EXISTS idx_historial_rut_nuevo ON historial_activos(rut_nuevo);
CREATE INDEX IF NOT EXISTS idx_historial_rut_anterior ON historial_activos(rut_anterior);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_activos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_tipo ON historial_activos(tipo_movimiento);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON colaboradores;
CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_activos_updated_at ON activos;
CREATE TRIGGER trg_activos_updated_at
  BEFORE UPDATE ON activos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista: activos con colaborador
CREATE OR REPLACE VIEW v_activos AS
SELECT
  a.*,
  c.nombre  AS colaborador_nombre,
  c.correo  AS colaborador_correo,
  c.area    AS colaborador_area,
  c.cargo   AS colaborador_cargo
FROM activos a
LEFT JOIN colaboradores c ON a.rut_responsable = c.rut;

-- Vista: resumen por colaborador
CREATE OR REPLACE VIEW v_colaboradores_resumen AS
SELECT
  c.*,
  COUNT(a.serie) FILTER (WHERE a.estado = 'Asignado') AS total_activos_asignados
FROM colaboradores c
LEFT JOIN activos a ON a.rut_responsable = c.rut
GROUP BY c.id, c.rut;
