# 🎨 Frontend - React - Inventario Domino's TI

Interfaz moderna y responsiva construida con React, Vite, TypeScript y Tailwind CSS.

## 🚀 Características

- ✅ Autenticación JWT con login corporativo
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión de activos (CRUD)
- ✅ Búsqueda y filtros
- ✅ Interfaz responsive (móvil, tablet, desktop)
- ✅ Componentes reutilizables
- ✅ Estado global con Zustand
- ✅ Formularios validados con React Hook Form + Zod

## 📋 Requisitos

- Node.js v16+
- npm v8+

## 🔧 Instalación

```bash
cd frontend
npm install
```

## 🏃 Ejecutar

### Desarrollo
```bash
npm run dev
```
Abre: http://localhost:5173

### Build para Producción
```bash
npm run build
```

## 📁 Estructura

```
src/
├── api.js                 # Cliente HTTP con interceptores
├── App.jsx               # Componente raíz
├── main.jsx              # Entry point
├── index.css             # Estilos globales
├── components/
│   ├── Layout.jsx        # Layout principal
│   ├── Sidebar.jsx       # Barra de navegación
│   ├── ProtectedRoute.jsx # Rutas protegidas
│   └── ModalFormulario.jsx # Modal para activos
├── pages/
│   ├── LoginPage.jsx     # Página de login
│   ├── Dashboard.jsx     # Panel principal
│   ├── ActivosPage.jsx   # Gestión de activos
│   └── ColaboradoresPage.jsx
└── store/
    ├── authStore.js      # Store de autenticación (Zustand)
    └── activosStore.js   # Store de activos
```

## 🔑 Variables de Entorno

Crear archivo `.env`:

```bash
REACT_APP_API_URL=http://localhost:8080/api
```

## 🎯 Flujo de Autenticación

1. Usuario ingresa credenciales en LoginPage
2. Se envía POST a `/api/auth/login`
3. Backend retorna JWT token y datos de usuario
4. Token se almacena en localStorage
5. Se envía automáticamente en headers de futuras requests
6. Si token expira (401), se redirige a login

## 📦 Dependencias Principales

- **React 18**: UI library
- **React Router 6**: Navigation
- **Vite**: Build tool ultra rápido
- **Tailwind CSS**: Estilos utility-first
- **Zustand**: Estado global
- **React Hook Form**: Gestión de formularios
- **Zod**: Validación de esquemas
- **Axios**: Cliente HTTP
- **Lucide React**: Iconos

## 🎨 Tailwind CSS

Configurado en `tailwind.config.js` con colores personalizados:

```javascript
colors: {
  primary: '#0066CC',      // Azul Domino's
  secondary: '#E31837',    // Rojo Domino's
  success: '#22c55e',
  danger: '#ef4444',
}
```

## 📱 Responsive Design

- **Mobile**: Sidebar colapsada, diseño full-width
- **Tablet**: Sidebar toggle, grid 2 columnas
- **Desktop**: Sidebar fijo, grid 4 columnas

## 🔒 Seguridad

- ✅ JWT tokens en localStorage
- ✅ Tokens se envían en headers Authorization
- ✅ Autenticación en rutas protegidas
- ✅ Validación frontend con Zod
- ✅ Manejo de errores centralizado

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install
```

### CORS error
- Verifica que backend esté corriendo en puerto 8080
- Revisa REACT_APP_API_URL en `.env`

### Token expirado
- El interceptor de Axios maneja automáticamente
- Se redirige a login si recibe 401

## 📚 Documentación

- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [React Router](https://reactrouter.com)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Hook Form](https://react-hook-form.com)
- [Tailwind CSS](https://tailwindcss.com)

## 🚀 Deploy

### Vercel (recomendado para React)

1. Push a GitHub
2. Conecta repo en vercel.com
3. Define REACT_APP_API_URL en production
4. Deploy automático

### Netlify

1. Build localmente: `npm run build`
2. Deploy carpeta `dist`

### Otros

También puedes deployar en Railway, Render, etc.

## 🤝 Contribuciones

Para agregar features:

1. Crea rama: `git checkout -b feature/nueva-feature`
2. Commit: `git commit -m "Add: nueva feature"`
3. Push: `git push origin feature/nueva-feature`
4. PR en main

## 📝 Notas

- Los archivos `.env` con credenciales NO se commitean
- Usar `.env.example` como referencia
- Mantener componentes pequeños y reutilizables
- Documentar componentes complejos

---

**Versión:** 1.0.0  
**Última actualización:** 2026-02-03  
**Equipo:** TI Domino's Chile
