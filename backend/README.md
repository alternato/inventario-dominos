# Backend — IT COMPASS (Inventario TI Domino's Chile)

API REST construida con Node.js + Express + PostgreSQL. Autohospedada en Docker.

## Stack

- **Runtime**: Node.js v20 (Alpine)
- **Framework**: Express 4
- **Base de datos**: PostgreSQL 15 via `pg` (pool nativo)
- **Auth**: JWT en cookie `httpOnly` + Microsoft MSAL/Azure Entra ID SSO
- **Validación**: Zod (`schemas.js`) — incluye validación de RUT chileno con dígito verificador
- **Email**: Nodemailer (SMTP)
- **Agente IA**: `@anthropic-ai/sdk` — Claude con tool use (`agent.js`)
- **Linting**: ESLint 8 (`.eslintrc.cjs`)

## Requisitos

- Node.js v20+
- PostgreSQL 15 (o usar Docker Compose)

## Instalación local

```bash
cp .env.example .env
# Editar .env con tus credenciales
npm install
npm run dev
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las críticas:

| Variable | Descripción |
|---|---|
| `DB_HOST` | `localhost` en dev, `db` en Docker Compose |
| `JWT_SECRET` | Secreto largo y aleatorio. Nunca committear el real. |
| `ANTHROPIC_API_KEY` | Para el agente IA. Sin esta clave `/api/chat` devuelve 503. Obtener en console.anthropic.com |
| `FRONTEND_URL` | URL del frontend (para CORS y links de email) |

## Estructura de archivos

```
backend/
├── scripts/           # Scripts utilitarios (seed, migración de datos, conciliación)
├── migrations/        # Migraciones SQL correlativas (004, 005, ...)
├── agent.js           # Agente IA: loop tool use con Claude API
├── db.js              # Pool pg + todas las funciones de consulta SQL
├── mail.js            # Plantillas HTML de correo + envío SMTP
├── schemas.js         # Schemas Zod para validación de requests + validarRut()
├── server.js          # Punto de entrada: middlewares, rutas Express
├── schema.sql         # DDL completo: tablas, vistas, índices
└── Dockerfile
```

## Endpoints principales

Todos requieren cookie de sesión (JWT `httpOnly`) excepto los marcados como públicos.

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login local (email + password) |
| POST | `/api/auth/sso-login` | Login Microsoft MSAL |
| GET | `/api/auth/verify` | Verificar sesión activa |
| POST | `/api/auth/logout` | Cerrar sesión (limpia cookie) |
| POST | `/api/auth/forgot-password` | Solicitar reset de contraseña |
| POST | `/api/auth/reset-password` | Aplicar nueva contraseña con token |

### Activos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/activos` | Listar activos (via vista `v_activos`) |
| GET | `/api/activos/:serie` | Obtener activo por serie |
| POST | `/api/activos` | Crear activo *(admin)* |
| PUT | `/api/activos/:serie` | Actualizar activo *(admin)* |
| DELETE | `/api/activos/:serie` | Soft delete *(admin)* |

### Colaboradores
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/colaboradores` | Listar colaboradores |
| POST | `/api/colaboradores` | Crear colaborador *(admin)* |
| PUT | `/api/colaboradores/:rut` | Actualizar colaborador *(admin)* |
| DELETE | `/api/colaboradores/:rut` | Soft delete + desasignar equipos *(admin)* |

### Asignaciones
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/asignaciones` | Listar asignaciones (filtros: estado, serie, rut) |
| POST | `/api/asignaciones` | Asignar equipo a colaborador *(admin)* |
| PUT | `/api/asignaciones/:id/cerrar` | Solicitar devolución → envía email con token |
| GET | `/api/asignaciones/confirmar/:token` | **[PÚBLICO]** Confirmación digital de devolución |

### Agente IA
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/chat` | Conversación multi-turno con el agente Claude (rate limit: 20 req/min) |

**Body:** `{ mensajes: [{ role, content }, ...] }` — historial completo de la conversación.  
**Response:** `{ respuesta: string, historial: [...] }`

### Otros
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/kpis` | KPIs para el Dashboard |
| GET | `/api/areas` | Listar áreas |
| POST | `/api/areas` | Crear área *(admin)* |
| GET | `/api/historial` | Historial de auditoría |
| POST | `/api/import/preview` | Preview importación masiva (dry-run) |
| POST | `/api/import/commit` | Confirmar importación |
| GET | `/health` | Health check (no requiere auth) |

## Agente IA — `agent.js`

Implementa el patrón **agentic loop** de Anthropic. El agente itera hasta 10 veces:
1. Llama a `claude-haiku-4-5-20251001` con el historial y las herramientas.
2. Si `stop_reason === 'tool_use'`, ejecuta las herramientas en paralelo.
3. Si `stop_reason === 'end_turn'`, devuelve la respuesta final.

Herramientas disponibles: `buscar_activos`, `actualizar_activo`, `obtener_resumen`, `listar_colaboradores`.

## Roles y permisos

| Rol | Permisos |
|---|---|
| `viewer` | Solo lectura |
| `admin` | Lectura + escritura de activos, colaboradores y asignaciones |
| `superadministrador` | Todo + gestión de usuarios y operaciones de mantenimiento |

## Despliegue en producción (Docker)

```bash
# Actualizar y reconstruir
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Ver logs en vivo
docker compose -f docker-compose.prod.yml logs -f backend

# Recrear solo el backend (ej. tras cambiar .env)
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
```

## Troubleshooting frecuente

**`/api/chat` devuelve 503**  
→ `ANTHROPIC_API_KEY` no está en el `.env` del servidor o está vacía.

**`/api/chat` devuelve 500 "API key inválida o revocada"**  
→ La key fue revocada. Generar nueva en console.anthropic.com y reemplazar en `.env`. Luego: `docker compose ... up -d --force-recreate backend`.

**`printenv ANTHROPIC_API_KEY` muestra una key antigua aunque el `.env` tiene una nueva**  
→ Hay una variable de entorno del shell sobreescribiendo el `.env`. Ejecutar `unset ANTHROPIC_API_KEY` antes de recrear el contenedor. Verificar que no esté definida en `~/.bashrc` o `/etc/environment`.

**Error 500 "API key inválida" con créditos en cero**  
→ Agregar créditos en console.anthropic.com → Billing.

**Build de frontend falla con "Expression expected" en `constants.js`**  
→ El archivo `frontend/src/components/activos/constants.jsx` contiene JSX y debe tener extensión `.jsx`. Si se renombra localmente pero no se commitea, el servidor sigue usando el `.js`.
