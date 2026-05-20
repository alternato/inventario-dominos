-- ============================================================
-- MIGRACIÓN 005: Tabla de Áreas y Eliminación de Restricciones Check
-- Domino's Pizza Chile - Inventario TI
-- ============================================================

-- 1. Eliminar la restricción check del campo area en colaboradores si existe
ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS colaboradores_area_check;

-- 2. Crear tabla areas
CREATE TABLE IF NOT EXISTS areas (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(255) UNIQUE NOT NULL
);

-- 3. Poblar las áreas iniciales
INSERT INTO areas (nombre) VALUES 
('Operaciones'),
('Administración'),
('Logística'),
('TI'),
('RRHH'),
('Marketing'),
('Otro')
ON CONFLICT (nombre) DO NOTHING;
