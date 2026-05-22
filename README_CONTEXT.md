# Contexto Maestro de Proyecto: IT COMPASS (Inventario TI Domino's Pizza Chile)

Este documento centraliza toda la información técnica, lógica, operativa y de base de datos de **IT COMPASS** (versión actual: **v1.2.1**), optimizado para que agentes AI como **Claude Code** entiendan el codebase al instante.

> **Última actualización:** 2026-05-22 — Agente IA, ESLint/Prettier, CI/CD, validación RUT, reorganización scripts.

---

## 📋 Descripción del Sistema
**IT COMPASS** es una aplicación web autohospedada para la administración del inventario de TI de **Domino's Pizza Chile**, migrado recientemente de Supabase a un stack propio en contenedores Docker de PostgreSQL + Node.js + React.

### Ejes de Negocio
1.  **Activos (Equipos TI)**: Laptops, Desktops, Smartphones, SIM Cards con sus marcas, modelos, series, IMEIs, IMSIs, números telefónicos y compañías telefónicas.
2.  **Colaboradores**: Empleados activos de la compañía asociados a un RUT, cargo, correo y área de trabajo.
3.  **Asignaciones (Tercer Eje)**: Controla el historial de asignaciones y devoluciones con marcas temporales, notas y un sistema de firma/confirmación digital por correo.

---

## 🛠️ Stack Tecnológico
*   **Base de Datos**: PostgreSQL 15-alpine (Dockerizado).
*   **Backend API**: Node.js v20 (Express, `pg` nativo, `nodemailer` SMTP, `jsonwebtoken`, `@anthropic-ai/sdk` para el agente IA).
*   **Frontend**: React 18 (Vite, Zustand, Tailwind CSS, Lucide icons, React Hook Form + Zod, `vite-plugin-pwa`).
*   **Infraestructura**: Docker Compose (`docker-compose.yml` dev, `docker-compose.prod.yml` prod). CI/CD con GitHub Actions (`.github/workflows/ci.yml`).
*   **Calidad**: ESLint 8 + Prettier en frontend y backend. ESLint config en `.eslintrc.cjs` (frontend ESM requiere CJS para eslint).

---

## 📁 Estructura del Workspace
```text
inventario-dominos/
├── .github/workflows/ci.yml       # CI: lint + build en push/PR a main
├── backend/
│   ├── scripts/                   # Scripts utilitarios (seed, migración, conciliación, etc.)
│   ├── migrations/                # Scripts SQL de migraciones correlativas
│   │   ├── 004_asignaciones.sql
│   │   └── 005_crear_tabla_areas.sql
│   ├── agent.js                   # Agente IA: tool use con Claude API (buscar/actualizar activos)
│   ├── db.js                      # Capa de datos (consultas SQL parametrizadas con pg Pool)
│   ├── mail.js                    # Plantillas de correo y envíos SMTP
│   ├── schemas.js                 # Schemas Zod + validación RUT chileno (dígito verificador)
│   ├── server.js                  # Rutas API Express (incluye POST /api/chat para el agente)
│   ├── schema.sql                 # Script maestro de inicialización de la BD
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── activos/
│   │   │   │   └── constants.jsx  # IMPORTANTE: extensión .jsx (contiene JSX, no .js)
│   │   │   ├── AgentChat.jsx      # Chat flotante del agente IA (bottom-right)
│   │   │   ├── Layout.jsx         # Layout principal (incluye <AgentChat />)
│   │   │   └── ...                # Modales, Navbar, etc.
│   │   ├── pages/                 # ActivosPage, ColaboradoresPage, HistorialPage, AjustesPage
│   │   ├── store/                 # Zustand (activosStore.js)
│   │   ├── authConfig.js          # Configuración Azure MSAL
│   │   ├── msalInstance.js        # PublicClientApplication de MSAL
│   │   ├── api.js                 # Cliente Axios
│   │   └── main.jsx
│   ├── public/
│   │   └── favicon.ico            # 340 bytes (32x32, fondo azul #0066CC con 'D')
│   ├── vite.config.js             # PWA config: favicon.ico excluido del precache Workbox
│   ├── Dockerfile.prod            # Build Vite → Nginx serving static
│   └── package.json
├── docker-compose.yml             # Orquestación desarrollo local
└── docker-compose.prod.yml        # Orquestación producción (Frontend: 8080, Backend: 8081)
```

---

## ⚙️ Variables de Entorno (`.env`)

Tanto en desarrollo local como en producción, las siguientes variables son configuradas en el archivo `.env` o `.env.production` en la raíz del repositorio:

```ini
PORT=8081                        # Puerto de escucha del backend
NODE_ENV=production              # Modo ('development' o 'production')

# Conexión a PostgreSQL
DB_HOST=db                       # 'localhost' localmente, 'db' en docker-compose
DB_PORT=5432
DB_NAME=inventario_db
DB_USER=inventario_user
DB_PASSWORD=contrasena_secreta_aqui
DB_SSL=false                     # 'true' para forzar conexiones SSL

# Seguridad JWT — token almacenado en cookie httpOnly (NO localStorage)
JWT_SECRET=un_secreto_largo_y_aleatorio_aqui
JWT_EXPIRES_IN=12h

# Servidor SMTP (Notificaciones por Correo)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=ti@dominospizza.cl
SMTP_PASSWORD=contrasena_smtp_aqui
EMAIL_FROM=noreply@dominospizza.cl

# Integración de Enrutamiento
FRONTEND_URL=http://tu-dominio-inventario.cl:8080
BACKEND_URL=http://tu-dominio-api.cl:8081        # Usado para links de confirmación de devoluciones

# Agente IA (Claude / Anthropic) — sin esta clave /api/chat devuelve 503
ANTHROPIC_API_KEY=sk-ant-api03-...               # Obtener en console.anthropic.com → API Keys
```

> **Nota de seguridad:** El JWT viaja en una cookie `httpOnly; Secure; SameSite=Strict` — nunca en `localStorage`. `ANTHROPIC_API_KEY` no debe commitearse; agrégala directamente al `.env` del servidor (ver sección de despliegue).

---

## 🔐 Autenticación y Seguridad

El sistema soporta dos vías de autenticación concurrentes controladas en `backend/server.js`:

### 1. Autenticación Local
*   Usa credenciales tradicionales (correo y contraseña).
*   Las contraseñas se encriptan con `bcryptjs` (salt de 10).
*   Se genera un token JWT firmado mediante `jsonwebtoken` que se retorna al cliente y se valida a través del middleware `authenticate`.

### 2. Autenticación Microsoft (MSAL / Azure Entra ID)
*   **Frontend**: Inicializa MSAL usando `@azure/msal-browser` con el `clientId` `4361c762-9ecd-4da0-b136-dafcbb63aa7f` y el tenant `796cb01d-5824-4199-9177-a82623fb5e38` de Domino's Pizza.
*   Al hacer login con Microsoft, el frontend obtiene el token de acceso (`access_token`) y el email del colaborador de Azure AD.
*   **Backend**: Recibe el token de Microsoft mediante el endpoint `/api/auth/msal-login`, valida que pertenezca al dominio Domino's, verifica si el usuario existe en la tabla `usuarios` y le genera un token JWT interno de sesión del sistema.

---

## 🗄️ Modelo de Base de Datos (PostgreSQL)

### Tablas Principales:
1.  **`usuarios`**:
    *   `id` SERIAL PRIMARY KEY
    *   `email` VARCHAR(255) UNIQUE NOT NULL
    *   `nombre` VARCHAR(255) NOT NULL
    *   `password` VARCHAR(255) NOT NULL (bcrypt hash)
    *   `rol` VARCHAR(50) CHECK IN (`admin`, `viewer`, `superadministrador`)
    *   `pin` VARCHAR(255) (opcional, para firma/seguridad del dashboard antiguo)
2.  **`colaboradores`**:
    *   `id` SERIAL PRIMARY KEY
    *   `rut` VARCHAR(50) UNIQUE NOT NULL (Formato normalizado sin puntos: `12345678-9`)
    *   `nombre` VARCHAR(255) NOT NULL
    *   `correo` VARCHAR(255)
    *   `area` VARCHAR(100) NOT NULL (Ej: `Operaciones`, `Administración`, `TI`, `RRHH`, `Marketing`, etc.)
    *   `cargo` VARCHAR(255), `telefono` VARCHAR(20), `activo` BOOLEAN
3.  **`areas`**:
    *   `id` SERIAL PRIMARY KEY
    *   `nombre` VARCHAR(255) UNIQUE NOT NULL
4.  **`activos`**:
    *   `id` SERIAL PRIMARY KEY
    *   `serie` VARCHAR(100) UNIQUE NOT NULL
    *   `marca` y `modelo` VARCHAR(100) NOT NULL
    *   `estado` VARCHAR(50) CHECK IN (`Asignado`, `Disponible`, `Mantenimiento`, `Descartado`)
    *   `tipo_dispositivo` VARCHAR(100) CHECK IN (`Laptop`, `Desktop`, `Smartphone`, `Tablet`, `SIM Card`, `Impresora`, `Monitor`, `Servidor`, `Otro`)
    *   `rut_responsable` VARCHAR(50) REFERENCES `colaboradores(rut)` ON DELETE SET NULL
    *   `imei` VARCHAR(50), `numero_sim` VARCHAR(50), `imsi` VARCHAR(50), `numero_telefono` VARCHAR(50), `compania` VARCHAR(100)
5.  **`asignaciones`**:
    *   `id` SERIAL PRIMARY KEY
    *   `serie_activo` REFERENCES `activos(serie)` ON DELETE CASCADE
    *   `rut_colaborador` REFERENCES `colaboradores(rut)` ON DELETE CASCADE
    *   `fecha_inicio` TIMESTAMP DEFAULT NOW(), `fecha_fin` TIMESTAMP
    *   `entregado_por` VARCHAR(255), `motivo_devolucion` VARCHAR(100), `estado_fisico_devolucion` VARCHAR(50), `notas` TEXT
    *   `token_confirmacion` VARCHAR(100) UNIQUE, `token_expira_at` TIMESTAMP, `confirmado_at` TIMESTAMP, `confirmado_via` VARCHAR(50)
    *   `estado` VARCHAR(20) DEFAULT `'activa'` CHECK IN (`activa`, `cerrada`, `pendiente_firma`, `cancelada`)
6.  **`historial_activos`**: Trazabilidad completa de auditoría e historial.

### Vistas Críticas:
*   **`v_activos`**: Expone todos los activos relacionándolos con su responsable directo (`colaboradores`) y los datos de su asignación activa actual (`asignacion_id`, `asignacion_fecha_inicio`, `asignacion_entregado_por`).

---

## 📡 Catálogo de la API (Endpoints Backend)

Todos los endpoints (excepto el login, recuperación de clave y confirmación pública) requieren autorización mediante cabecera Bearer Token (`Authorization: Bearer <JWT_TOKEN>`).

### Autenticación
*   `POST /api/auth/login`: Login local con email y password.
*   `POST /api/auth/msal-login`: Login con token de Microsoft Azure AD.
*   `GET /api/auth/verify`: Verifica validez de sesión.
*   `POST /api/auth/forgot-password`: Generación de token temporal de recuperación.
*   `POST /api/auth/reset-password`: Reseteo de contraseña usando token temporal.

### Usuarios (Administración)
*   `GET /api/usuarios`: Listar usuarios.
*   `POST /api/usuarios`: Crear usuario (Rol: `admin` o `superadministrador` requerido).
*   `PUT /api/usuarios/:id`: Modificar datos y rol de usuario.
*   `DELETE /api/usuarios/:id`: Eliminar usuario.

### Activos (Equipos TI)
*   `GET /api/activos`: Obtiene listado de activos mediante la vista `v_activos`.
*   `POST /api/activos`: Crear un nuevo activo.
*   `GET /api/activos/:serie`: Obtener un activo específico.
*   `PUT /api/activos/:serie`: Actualizar datos físicos y estado del activo.
*   `DELETE /api/activos/:serie`: Ocultación lógica (Soft Delete) del activo.

### Colaboradores
*   `GET /api/colaboradores`: Listar todos los colaboradores.
*   `POST /api/colaboradores`: Crear colaborador.
*   `PUT /api/colaboradores/:rut`: Actualizar colaborador.
*   `DELETE /api/colaboradores/:rut`: Ocultación lógica del colaborador y desasignación automática de sus equipos.
*   `GET /api/colaboradores/:rut/activos`: Obtener activos actualmente asignados a un colaborador.

### Áreas (Lista Maestra)
*   `GET /api/areas`: Retorna la lista maestra de áreas de la tabla `areas`.
*   `POST /api/areas`: Crea un área en la lista maestra.
*   `PUT /api/areas/:id`: Renombrar área.
*   `DELETE /api/areas/:id`: Eliminar área de la lista maestra.

### Asignaciones (Tercer Eje)
*   `GET /api/asignaciones`: Obtener lista de asignaciones filtradas.
*   `POST /api/asignaciones`: Asignar equipo disponible a un colaborador. Genera registro de asignación activa, actualiza el estado del activo a `'Asignado'` y gatilla alerta por mail a RRHH.
*   `PUT /api/asignaciones/:id/cerrar`: Solicitar devolución. Cierra la asignación física, cambia el estado de la asignación a `'pendiente_firma'`, y envía el enlace con token digital para la firma al colaborador (vía correo corporativo o personal).
*   `GET /api/asignaciones/confirmar/:token`: **[ENDPOINT PÚBLICO]** Renderiza el panel HTML responsivo de confirmación digital. Cuando el colaborador da clic en "Confirmar", cambia el estado de la asignación a `'cerrada'` y actualiza la fecha de confirmación.

### Reportería e Importaciones
*   `GET /api/historial`: Reporte e historial de auditoría de movimientos.
*   `GET /api/kpis`: Métricas y estadísticas para el Dashboard (totales, por estado, por tipo, alertas de IMEIs y SIMs duplicados).
*   `POST /api/import/preview`: Preview de importación masiva desde Excel (dry-run).
*   `POST /api/import/commit`: Confirmar importación masiva.
*   `GET /api/export-sql`: Exportar inventario completo en SQL (superadmin).

### Agente IA
*   `POST /api/chat` *(autenticado, rate limit: 20 req/min)*: Conversación multi-turno con el agente Claude. Recibe `{ mensajes: [...] }` con el historial completo y devuelve `{ respuesta, historial }`. El agente tiene acceso a 4 herramientas internas: `buscar_activos`, `actualizar_activo`, `obtener_resumen`, `listar_colaboradores`. Requiere `ANTHROPIC_API_KEY` válida con créditos; sin ella devuelve 503.

---

## 🔄 Flujo de Firma y Confirmación Digital en Devoluciones

```mermaid
sequenceDiagram
    participant Admin as Administrador (TI)
    participant API as Backend (Express API)
    participant SMTP as Servidor SMTP
    participant Colab as Colaborador

    Admin->>API: PUT /api/asignaciones/:id/cerrar { correo_alterno, desvincular }
    Note over API: Genera token seguro y expira_at (72h)
    Note over API: Pone asignación en 'pendiente_firma'
    Note over API: Pone Activo en 'Disponible'
    API->>SMTP: Enviar Email de confirmación con token
    SMTP->>Colab: Recibe Email con link a confirmación digital
    Colab->>API: GET /api/asignaciones/confirmar/:token
    API->>Colab: Renderiza Vista HTML responsiva para Firmar
    Colab->>API: Clic en "Confirmar Devolución" (POST/GET confirmación)
    Note over API: Pone asignación en 'cerrada'
    Note over API: Registra timestamp confirmado_at
    API->>Colab: Renderiza pantalla de éxito "Devolución Confirmada"
```

---

## 🛠️ Comandos de Operación en Producción (Docker)

### 1. Actualizar el Servidor:
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. Ejecutar Migraciones de Base de Datos:
```bash
# Migración 004 (Tabla de Asignaciones)
docker exec -it inventario_backend_prod node run-migration.js 004_asignaciones.sql

# Migración 005 (Tabla de Áreas y Constraints)
docker exec -it inventario_backend_prod node run-migration.js 005_crear_tabla_areas.sql
```

### 3. Migrar los Datos de Asignación Existentes:
```bash
docker exec -it inventario_backend_prod node migrate-asignaciones.js
```

### 4. Monitorear logs del sistema en caliente:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### 5. Configurar ANTHROPIC_API_KEY en producción:
```bash
# Si hay key duplicada en .env (causada por >> múltiples veces):
nano /var/www/inventario-dominos/.env   # dejar solo una línea ANTHROPIC_API_KEY=...

# Verificar que NO haya variable de entorno del shell sobreescribiendo el .env:
echo $ANTHROPIC_API_KEY               # si muestra algo, ejecutar: unset ANTHROPIC_API_KEY

# Recrear contenedor para que tome el .env actualizado:
docker compose -f docker-compose.prod.yml up -d --force-recreate backend

# Verificar que el contenedor tenga la key correcta:
docker exec inventario_backend_prod printenv ANTHROPIC_API_KEY
```

---

## 🤖 Agente IA — Arquitectura

El agente está implementado en `backend/agent.js` usando el patrón **agentic loop** de la API de Anthropic:

1. Recibe el historial de mensajes desde el frontend (`AgentChat.jsx`).
2. Llama a `claude-haiku-4-5-20251001` con `tools` definidas.
3. Si `stop_reason === 'tool_use'`, ejecuta las herramientas en paralelo y agrega los resultados al historial.
4. Repite hasta `stop_reason === 'end_turn'` (máx. 10 iteraciones).
5. Devuelve `{ respuesta, historial }` al frontend.

**Herramientas disponibles:**

| Herramienta | Descripción |
|---|---|
| `buscar_activos` | Filtra activos por tipo, estado, marca, modelo o texto libre |
| `actualizar_activo` | Modifica tipo, estado, marca, modelo, ubicación u observaciones de un activo por serie |
| `obtener_resumen` | Estadísticas del inventario: totales por tipo y estado |
| `listar_colaboradores` | Lista colaboradores con filtro por nombre, RUT o área |

**Notas importantes:**
- El agente **siempre consulta antes de modificar** (instrucción en system prompt).
- Los archivos JSX en `frontend/src/components/activos/` deben tener extensión `.jsx` (no `.js`), de lo contrario Vite/Rollup falla en producción.
- La ruta `/api/chat` debe declararse **antes** del middleware 404 en `server.js`.
