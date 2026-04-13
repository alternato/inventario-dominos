#!/bin/bash

# ==========================================================
# Domino's Inventory - Automated Backup Script
# Guarda respaldos de PostgreSQL en un directorio local
# ==========================================================

# Definir la ruta donde se guardarán los backups (relativa al script o absoluta)
BACKUP_DIR="$(pwd)/db_backups"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Formato de fecha para el nombre del archivo
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/inventario_$DATE.sql.gz"

echo "=============================================="
echo "Iniciando respaldo de PostgreSQL a las $(date)"
echo "Ruta destino: $BACKUP_FILE"
echo "=============================================="

# Ejecutar pg_dump dentro del contenedor de la base de datos
# Comprimiendo directamente con gzip
docker exec inventario_db pg_dump -U postgres inventario_dominos | gzip > "$BACKUP_FILE"

# Verificar si el respaldo fue exitoso
if [ $? -eq 0 ]; then
  echo "✅ Respaldo comprimido exitosamente."
else
  echo "❌ Error al generar el respaldo."
  exit 1
fi

# ==========================================================
# (Opcional) Limpieza: Borrar backups más antiguos de 30 días
# ==========================================================
# find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -exec rm {} \;
# echo "Limpieza de respaldos antiguos completada."
