# 🚀 Backend - Inventario TI Domino's Chile

Sistema profesional de backend para gestión de inventario de activos TI con autenticación corporativa, roles de usuario y base de datos PostgreSQL en Supabase.

## 📋 Requisitos

- **Node.js** v16 o superior
- **npm** v8 o superior
- **Cuenta Supabase** (ya configurada)
- **Variables de entorno** (.env)

## 🔧 Instalación

### 1. Crear archivo `.env`

Copia el archivo `.env.example` a `.env` y completa con tus credenciales:

```bash
cp .env.example .env
```

Luego edita `.env` con:

```bash
PORT=8080
SUPABASE_URL=https://ivjwxvhixrskraepqzse.supabase.co
SUPABASE_KEY=tu-clave-supabase-aqui
JWT_SECRET=tu-secreto-jwt-muy-seguro
JWT_EXPIRES_IN=8h
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@dominospizza.cl
SMTP_PASSWORD=tu-contraseña-app
EMAIL_FROM=noreply@dominospizza.cl
FRONTEND_URL=http://localhost:3000
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear tablas en Supabase

Abre la consola SQL de Supabase y ejecuta el contenido del archivo `schema.sql`:

1. Ve a tu proyecto Supabase
2. Abre la pestaña "SQL Editor"
3. Crea una nueva query
4. Copia todo el contenido de `backend/schema.sql`
5. Ejecuta la query

### 4. Crear usuario admin inicial

```bash
node seed-admin.js
```

Esto creará un usuario admin con credenciales iniciales que **debes cambiar después del primer login**.

## 🚀 Iniciar el servidor

```bash
# Modo producción
npm start

# Modo desarrollo (con auto-reload)
npm run dev
```

El servidor estará disponible en `http://localhost:8080`

## 📚 Endpoints de API

### 🔐 Autenticación

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@dominospizza.cl",
  "password": "tu-contraseña"
}

Response:
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": 1,
    "email": "usuario@dominospizza.cl",
    "nombre": "Nombre Usuario",
    "rol": "admin"
  }
}
```

#### Recuperar contraseña
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "usuario@dominospizza.cl"
}

Response:
{
  "message": "Instrucciones de recuperación enviadas al email"
}
```

#### Resetear contraseña
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "token-de-recuperacion",
  "newPassword": "nueva-contraseña"
}

Response:
{
  "message": "Contraseña actualizada exitosamente"
}
```

### 📦 Activos

Todos los endpoints requieren autenticación con header:
```
Authorization: Bearer {token}
```

#### Listar activos
```
GET /api/activos
Authorization: Bearer {token}

Response: [
  {
    "id": 1,
    "serie": "ABC123",
    "marca": "Lenovo",
    "modelo": "ThinkPad E15",
    "estado": "Asignado",
    "tipo_dispositivo": "Laptop",
    ...
  }
]
```

#### Crear activo (admin)
```
POST /api/activos
Authorization: Bearer {token}
Content-Type: application/json

{
  "serie": "ABC123",
  "marca": "Lenovo",
  "modelo": "ThinkPad E15",
  "estado": "Asignado",
  "tipo_dispositivo": "Laptop",
  "rut_responsable": "12345678-K",
  "ubicacion": "Santiago - Oficina",
  "observaciones": "Sin problemas",
  "fecha_compra": "2023-01-15",
  "valor": "1500000",
  "numero_factura": "FAC-001"
}

Response:
{
  "message": "Activo creado exitosamente",
  "data": { ... }
}
```

#### Actualizar activo (admin)
```
PUT /api/activos/:serie
Authorization: Bearer {token}
Content-Type: application/json

{
  "estado": "Mantenimiento",
  "observaciones": "Cambio de disco duro"
}

Response:
{
  "message": "Activo actualizado exitosamente",
  "data": { ... }
}
```

#### Eliminar activo (admin)
```
DELETE /api/activos/:serie
Authorization: Bearer {token}

Response:
{
  "message": "Activo eliminado exitosamente"
}
```

### 👥 Colaboradores

#### Listar colaboradores
```
GET /api/colaboradores
Authorization: Bearer {token}

Response: [
  {
    "rut": "12345678-K",
    "nombre": "Juan Pérez",
    "correo": "juan@dominospizza.cl",
    "area": "TI",
    ...
  }
]
```

#### Crear colaborador (admin)
```
POST /api/colaboradores
Authorization: Bearer {token}
Content-Type: application/json

{
  "rut": "12345678-K",
  "nombre": "Juan Pérez",
  "correo": "juan@dominospizza.cl",
  "area": "TI",
  "cargo": "Especialista IT",
  "telefono": "+56912345678"
}

Response:
{
  "message": "Colaborador creado exitosamente",
  "data": { ... }
}
```

### 👤 Usuarios (admin)

#### Listar usuarios
```
GET /api/usuarios
Authorization: Bearer {token}

Response: [
  {
    "id": 1,
    "email": "admin@dominospizza.cl",
    "nombre": "Administrador",
    "rol": "admin",
    "activo": true
  }
]
```

#### Crear usuario (admin)
```
POST /api/usuarios
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "newuser@dominospizza.cl",
  "nombre": "Nuevo Usuario",
  "password": "ContraseñaSegura123",
  "rol": "viewer"
}

Response:
{
  "message": "Usuario creado exitosamente",
  "data": { ... }
}
```

### 💊 Health Check

```
GET /health

Response:
{
  "status": "Backend ejecutándose correctamente ✓",
  "timestamp": "2026-02-03T00:00:00.000Z",
  "version": "1.0.0"
}
```

## 🔐 Autenticación y Roles

### Roles disponibles:
- **admin**: Puede crear, modificar y eliminar activos y colaboradores
- **viewer**: Solo lectura de activos y colaboradores

### Flujo de autenticación:
1. Usuario hace login con email corporativo @dominospizza.cl
2. Backend valida credenciales
3. Backend retorna JWT token válido por 8 horas
4. Cliente almacena token en localStorage
5. Cliente envía token en header `Authorization: Bearer {token}` en cada request

## 🛡️ Seguridad

- ✅ Contraseñas hasheadas con bcrypt
- ✅ Autenticación JWT con expiración
- ✅ Validación de datos con Zod
- ✅ CORS habilitado
- ✅ Solo emails @dominospizza.cl permitidos
- ✅ Roles basados en permisos
- ✅ Tokens de recuperación de contraseña seguros

## 📧 Configuración de Email

Para recuperación de contraseña, necesitas configurar SMTP.

### Gmail (recomendado):
1. Habilita "Acceso de aplicaciones menos seguras" en tu cuenta Google
2. O usa una "Contraseña de Aplicación" (más seguro)
3. Configura en `.env`:
   - SMTP_HOST: smtp.gmail.com
   - SMTP_PORT: 587
   - SMTP_USER: tu-correo@gmail.com
   - SMTP_PASSWORD: tu-contraseña-app

## 🐛 Troubleshooting

### Error: "SUPABASE_URL is not defined"
- Verifica que el archivo `.env` exista y tenga SUPABASE_URL

### Error: "Token inválido"
- Verifica que JWT_SECRET esté configurado correctamente
- Asegúrate que el token no haya expirado

### Error: "Email o contraseña incorrectos"
- Verifica que el usuario exista en la base de datos
- Verifica que la contraseña sea correcta

### No llegan emails de recuperación
- Verifica credenciales SMTP
- Habilita "Aplicaciones menos seguras" en Gmail
- Revisa la carpeta de Spam

## 📖 Documentación Adicional

- [Documentación de Supabase](https://supabase.io/docs)
- [Documentación de Express.js](https://expressjs.com)
- [Documentación de JWT](https://jwt.io)
- [Documentación de Zod](https://zod.dev)

## 📝 Notas Importantes

1. **Cambiar JWT_SECRET**: En producción, cambiar a un valor único y seguro
2. **Variables de entorno**: Nunca commitear `.env` a git
3. **CORS**: Configurar con dominio específico en producción
4. **Logs**: Implementar servicio de logs en producción
5. **Backup**: Hacer backup regular de base de datos

## 🤝 Soporte

Para problemas o sugerencias, contacta al equipo de TI Domino's Chile.

---

**Versión:** 1.0.0  
**Última actualización:** 2026-02-03  
**Autor:** Equipo de TI Domino's Chile
