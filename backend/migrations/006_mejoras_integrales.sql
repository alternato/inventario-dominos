-- ============================================================
-- MIGRACIÓN 006: Mejoras integrales (índices, blindaje y denylist de sesiones)
-- Domino's Pizza Chile - Inventario TI
-- Ejecutar: psql -U inventario_user -d inventario_db -f migrations/006_mejoras_integrales.sql
-- Requisitos: 9.1, 9.4, 7.1, 11.5, 14.1
-- Todo idempotente: se puede re-ejecutar sin efectos secundarios.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Índices de orden por defecto de los listados (created_at DESC)
--    Aceleran el ordenamiento de los listados paginados (Req. 9.1, 9.4).
--    Nota: el esquema actual (schema.sql) NO define columna `deleted_at`
--    en `activos` ni `colaboradores`, por lo que el predicado parcial
--    `WHERE deleted_at IS NULL` no aplica y se omite. Si en el futuro se
--    introduce borrado lógico, este índice deberá recrearse con el filtro.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activos_created_at       ON activos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_colaboradores_created_at ON colaboradores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asig_created_at          ON asignaciones(created_at DESC);

-- ------------------------------------------------------------
-- 2. Búsqueda por texto insensible a mayúsculas (LIKE de db/busqueda.js)
--    Índices GIN trigram sobre las columnas más buscadas (Req. 9.4).
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_activos_serie_trgm  ON activos      USING gin (LOWER(serie)  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_activos_modelo_trgm ON activos      USING gin (LOWER(modelo) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_colab_nombre_trgm   ON colaboradores USING gin (LOWER(nombre) gin_trgm_ops);

-- ------------------------------------------------------------
-- 3. Índice único parcial: a lo sumo UNA asignación activa por activo.
--    Blindaje de última línea contra doble asignación a nivel BD:
--    aunque la lógica de aplicación falle, la BD rechaza una segunda
--    fila 'activa', que la capa de datos traduce a ConflictError 409
--    (Req. 7.1, 14.1).
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_asig_una_activa ON asignaciones(serie_activo) WHERE estado = 'activa';

-- ------------------------------------------------------------
-- 4. Columna de soporte: canal de confirmación de devolución.
--    Ya existe en la migración 004; se asegura su presencia de forma
--    idempotente por si se aplicó un esquema anterior sin ella.
-- ------------------------------------------------------------
ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS confirmado_via VARCHAR(50);
COMMENT ON COLUMN asignaciones.confirmado_via IS 'Canal usado para confirmar la devolución: corporativo | alterno';

-- ------------------------------------------------------------
-- 5. Denylist de sesiones para invalidación de tokens en logout (Req. 11.5).
--    Al emitir el token se incluye `jti`; en logout se inserta el `jti`
--    con su expiración y `authenticate` rechaza (401) cualquier token
--    cuyo `jti` figure aquí. Una tarea de limpieza elimina los vencidos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones_revocadas (
  jti        VARCHAR(64) PRIMARY KEY,
  expira_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesiones_revocadas_exp ON sesiones_revocadas(expira_at);

COMMENT ON TABLE sesiones_revocadas IS 'Denylist de JWT revocados (por jti) usada para invalidar sesiones en logout hasta su expiración';
