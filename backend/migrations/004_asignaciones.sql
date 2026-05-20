-- ============================================================
-- MIGRACIÓN 004: Tabla de Asignaciones (Tercer Eje)
-- Domino's Pizza Chile - Inventario TI
-- Ejecutar: psql -U inventario_user -d inventario_db -f migrations/004_asignaciones.sql
-- ============================================================

-- Tabla principal de asignaciones
CREATE TABLE IF NOT EXISTS asignaciones (
  id                        SERIAL PRIMARY KEY,
  serie_activo              VARCHAR(100) NOT NULL REFERENCES activos(serie) ON DELETE CASCADE,
  rut_colaborador           VARCHAR(50)  NOT NULL REFERENCES colaboradores(rut) ON DELETE CASCADE,
  fecha_inicio              TIMESTAMP    NOT NULL DEFAULT NOW(),
  fecha_fin                 TIMESTAMP,
  entregado_por             VARCHAR(255),
  motivo_devolucion         VARCHAR(100),
  estado_fisico_devolucion  VARCHAR(50),
  notas                     TEXT,
  falta_firma               BOOLEAN DEFAULT false,
  desvincular_colaborador   BOOLEAN DEFAULT false,
  -- Confirmación digital de devolución por email
  token_confirmacion        VARCHAR(100) UNIQUE,
  token_expira_at           TIMESTAMP,
  confirmado_at             TIMESTAMP,
  confirmado_via            VARCHAR(50),   -- 'corporativo' | 'alterno'
  -- Estado del ciclo de vida
  estado                    VARCHAR(20) NOT NULL DEFAULT 'activa'
                            CHECK (estado IN ('activa','cerrada','pendiente_firma','cancelada')),
  usuario_id                INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at                TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asig_serie   ON asignaciones(serie_activo);
CREATE INDEX IF NOT EXISTS idx_asig_rut     ON asignaciones(rut_colaborador);
CREATE INDEX IF NOT EXISTS idx_asig_estado  ON asignaciones(estado);
CREATE INDEX IF NOT EXISTS idx_asig_token   ON asignaciones(token_confirmacion) WHERE token_confirmacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asig_activa  ON asignaciones(serie_activo) WHERE estado = 'activa';

-- Agregar vista actualizada con asignación activa
CREATE OR REPLACE VIEW v_activos AS
SELECT
  a.*,
  c.nombre  AS colaborador_nombre,
  c.correo  AS colaborador_correo,
  c.area    AS colaborador_area,
  c.cargo   AS colaborador_cargo,
  asig.id   AS asignacion_id,
  asig.fecha_inicio AS asignacion_fecha_inicio,
  asig.entregado_por AS asignacion_entregado_por
FROM activos a
LEFT JOIN colaboradores c ON a.rut_responsable = c.rut
LEFT JOIN asignaciones asig ON asig.serie_activo = a.serie AND asig.estado = 'activa';

COMMENT ON TABLE asignaciones IS 'Tercer eje: registra el ciclo de vida completo de cada asignación de equipo a colaborador';
COMMENT ON COLUMN asignaciones.token_confirmacion IS 'Token único enviado por email al colaborador para confirmar la devolución (válido 72h)';
COMMENT ON COLUMN asignaciones.estado IS 'activa=en uso, cerrada=devuelta+confirmada, pendiente_firma=devuelta sin confirmar, cancelada=anulada';
