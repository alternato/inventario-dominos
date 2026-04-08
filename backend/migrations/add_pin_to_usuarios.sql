-- Migración: agregar columna pin a usuarios
-- Ejecutar en la base de datos PostgreSQL de inventario_db

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin VARCHAR(255) DEFAULT NULL;
COMMENT ON COLUMN usuarios.pin IS 'PIN numérico hasheado para acceso rápido. NULL = sin PIN configurado.';
