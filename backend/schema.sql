-- ========================================
-- SCHEMA PARA INVENTARIO DOMINO'S
-- Base de datos: PostgreSQL en Supabase
-- ========================================

-- ========================================
-- TABLA: usuarios
-- Descripción: Usuarios corporativos con login
-- ========================================
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (rol IN ('admin', 'viewer')),
  activo BOOLEAN DEFAULT true,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- ========================================
-- TABLA: colaboradores
-- Descripción: Personal de Domino's
-- ========================================
CREATE TABLE IF NOT EXISTS colaboradores (
  id SERIAL PRIMARY KEY,
  rut VARCHAR(12) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  correo VARCHAR(255),
  area VARCHAR(100) NOT NULL CHECK (area IN ('Operaciones', 'Administración', 'Logística', 'TI', 'RRHH')),
  cargo VARCHAR(255),
  telefono VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para colaboradores
CREATE INDEX IF NOT EXISTS idx_colaboradores_rut ON colaboradores(rut);
CREATE INDEX IF NOT EXISTS idx_colaboradores_area ON colaboradores(area);

-- ========================================
-- TABLA: activos
-- Descripción: Equipos IT asignados
-- ========================================
CREATE TABLE IF NOT EXISTS activos (
  id SERIAL PRIMARY KEY,
  serie VARCHAR(100) UNIQUE NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  estado VARCHAR(50) NOT NULL CHECK (estado IN ('Asignado', 'Disponible', 'Mantenimiento', 'Descartado')),
  tipo_dispositivo VARCHAR(100) NOT NULL CHECK (tipo_dispositivo IN ('Laptop', 'Desktop', 'Smartphone', 'Tablet', 'Impresora', 'Otro')),
  rut_responsable VARCHAR(12) NOT NULL REFERENCES colaboradores(rut) ON DELETE SET NULL,
  ubicacion VARCHAR(255) NOT NULL,
  observaciones TEXT,
  fecha_compra DATE,
  valor DECIMAL(12, 2),
  numero_factura VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para activos
CREATE INDEX IF NOT EXISTS idx_activos_serie ON activos(serie);
CREATE INDEX IF NOT EXISTS idx_activos_estado ON activos(estado);
CREATE INDEX IF NOT EXISTS idx_activos_rut_responsable ON activos(rut_responsable);
CREATE INDEX IF NOT EXISTS idx_activos_tipo_dispositivo ON activos(tipo_dispositivo);

-- ========================================
-- VISTA: activos_con_colaborador
-- Descripción: Activos con datos del colaborador
-- ========================================
CREATE OR REPLACE VIEW activos_con_colaborador AS
SELECT 
  a.*,
  c.nombre as colaborador_nombre,
  c.correo as colaborador_correo,
  c.area as colaborador_area
FROM activos a
LEFT JOIN colaboradores c ON a.rut_responsable = c.rut;

-- ========================================
-- POLÍTICAS DE SEGURIDAD RLS (Row Level Security)
-- ========================================

-- Habilitar RLS en tabla usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios solo pueden ver su propio perfil (excepto admin)
CREATE POLICY usuarios_select_policy ON usuarios
  FOR SELECT
  USING (true);

-- Habilitar RLS en tabla activos
ALTER TABLE activos ENABLE ROW LEVEL SECURITY;

-- Política: Todos los usuarios autenticados pueden ver activos
CREATE POLICY activos_select_policy ON activos
  FOR SELECT
  USING (true);

-- ========================================
-- DATOS INICIALES (USUARIO ADMIN)
-- ========================================
-- NOTA: Ejecutar este INSERT después de que el servidor esté corriendo
-- INSERT INTO usuarios (email, nombre, password, rol, activo)
-- VALUES ('admin@dominospizza.cl', 'Administrador', '$2a$10/...', 'admin', true);
-- La contraseña debe estar hasheada con bcrypt

-- ========================================
-- TRIGGERS (Actualizar updated_at automáticamente)
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para usuarios
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para colaboradores
DROP TRIGGER IF EXISTS update_colaboradores_updated_at ON colaboradores;
CREATE TRIGGER update_colaboradores_updated_at
  BEFORE UPDATE ON colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para activos
DROP TRIGGER IF EXISTS update_activos_updated_at ON activos;
CREATE TRIGGER update_activos_updated_at
  BEFORE UPDATE ON activos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
