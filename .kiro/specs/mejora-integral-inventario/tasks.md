# Implementation Plan

## Plan de Implementación — Mejora Integral del Inventario (IT COMPASS)

## Overview

Este plan traduce el diseño en una serie de tareas de codificación **incrementales, evolutivas y correctivas** sobre el sistema IT COMPASS **ya existente y en producción**. No hay reescrituras: cada tarea es un ajuste quirúrgico sobre archivos reales (`backend/app.js`, `backend/schemas.js`, capa `backend/db/`, `backend/routes/`, `backend/middleware.js`, `Interfaz_Web/src/...`). Se preserva la compatibilidad: los contratos cambian junto con sus consumidores dentro del mismo bloque de trabajo.

El orden respeta las dependencias: primero utilidades transversales del backend, luego la migración de BD, luego la centralización transaccional de asignaciones, después paginación/validación/seguridad, y finalmente los componentes de frontend. Las tareas de menor prioridad se marcan como opcionales (`*`) para permitir una ejecución escalonada / MVP.

Stack de implementación (definido en el diseño, sin ambigüedad): **Backend** Node.js/Express + PostgreSQL (`pg`), pruebas Jest + `supertest` + `fast-check`. **Frontend** React 18/Vite/Zustand/Tailwind, pruebas Vitest + `@testing-library/react` + `fast-check`.

Convención PBT: cada prueba de propiedad ejecuta ≥100 iteraciones (`fc.assert(fc.property(...), { numRuns: 100 })`) e incluye el comentario `// Feature: mejora-integral-inventario, Property {n}: {texto}`.

## Tasks

- [x] 1. Utilidades transversales del backend (base para todo lo demás)
  - [x] 1.1 Crear `backend/lib/apiError.js`
    - Implementar la clase `ApiError extends Error` con `status`, `type`, `details`
    - Añadir helpers estáticos: `ApiError.validation(msg, details)`, `ApiError.unauthorized(msg)`, `ApiError.forbidden(msg)`, `ApiError.notFound(msg)`, `ApiError.conflict(msg)`, `ApiError.gone(msg)`, `ApiError.internal(msg)`
    - Tipos permitidos: `VALIDATION | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | GONE | INTERNAL`
    - _Requisitos: 13.2, 12.3_

  - [x] 1.2 Escribir prueba de propiedad para el formato de error
    - **Property 31: Estructura uniforme del formato de error**
    - **Valida: Requisitos 13.2**
    - Verificar que cada `ApiError` mapea a `{ error: { type, message } }` con `type` en el conjunto definido y `status` coherente con el tipo
    - Ubicación: `backend/__tests__/apiError.test.js`

  - [x] 1.3 Crear `backend/lib/paginate.js`
    - Implementar `parsePagination(query)`: `pageSize` por defecto 50, techo 200, piso 1; `page` mínimo 1; devolver `{ limit, offset, page, size }`
    - Implementar helper `buildPaginationMeta(total, page, size)` → `{ page, pageSize, total, totalPages }`
    - _Requisitos: 9.2, 9.3_

  - [x] 1.4 Escribir pruebas de propiedad para la paginación
    - **Property 22: Normalización del tamaño de página** — **Valida: Requisitos 9.2**
    - **Property 23: Página fuera de rango devuelve vacío con total real** — **Valida: Requisitos 9.3**
    - Generar `pageSize`/`page` arbitrarios (ausente, no numérico, negativo, >200); comprobar rango [1,200], default 50 y meta consistente
    - Ubicación: `backend/__tests__/paginate.test.js`

  - [x] 1.5 Crear `backend/lib/sanitizeUsuario.js`
    - Implementar `sanitizeUsuario(u)` que elimina `password`, `reset_token`, `reset_token_expires` (soporta objeto único y arreglo)
    - _Requisitos: 12.4_

  - [x] 1.6 Escribir prueba de propiedad para el saneamiento de usuario
    - **Property 29: Exclusión de datos sensibles de usuario en respuestas**
    - **Valida: Requisitos 12.4**
    - Generar usuarios aleatorios (con/sin campos sensibles) y verificar que la salida nunca contiene `password`/`reset_token`/`reset_token_expires`
    - Ubicación: `backend/__tests__/sanitize.test.js`

  - [x] 1.7 Crear `backend/lib/logger.js`
    - Envoltura de logging que enmascara claves sensibles (`password`, `token`, `authToken`, `token_confirmacion`, `reset_token`) recursivamente antes de escribir
    - Exponer `logger.info/warn/error` reutilizables por rutas y el manejador de errores
    - _Requisitos: 12.5_

  - [x] 1.8 Escribir prueba de propiedad para el enmascaramiento de logs
    - **Property 30: Enmascaramiento de secretos en logs**
    - **Valida: Requisitos 12.5**
    - Generar objetos anidados con claves sensibles y valores aleatorios; verificar que la salida no contiene el valor en claro
    - Ubicación: `backend/__tests__/logger.test.js`

- [x] 2. Manejador de errores central uniforme
  - [x] 2.1 Actualizar el manejador de errores de `backend/app.js`
    - Serializar cualquier `ApiError` (o error genérico) a `{ error: { type, message, details } }`
    - En producción, los 500 devuelven `message` genérico; nunca exponer `stack` en la respuesta pública (solo vía `lib/logger.js`)
    - Ajustar el 404 de ruta no encontrada al mismo formato (`{ error: { type: 'NOT_FOUND', ... } }`)
    - Registrar el error real con `lib/logger.js`
    - _Requisitos: 13.2, 12.3_

  - [x] 2.2 Escribir prueba de propiedad para la respuesta de error de validación
    - **Property 28: Respuesta de error sin detalles internos ante validación fallida**
    - **Valida: Requisitos 12.3**
    - Provocar errores de validación en endpoints de escritura y verificar 400, mensaje de campo/regla, ausencia de traza y no persistencia
    - Ubicación: `backend/__tests__/apiError.test.js`

- [x] 3. Migración de base de datos 006 (índices, índice único parcial, denylist de sesiones)
  - [x] 3.1 Crear `backend/migrations/006_mejoras_integrales.sql`
    - Índices de orden: `idx_activos_created_at`, `idx_colaboradores_created_at`, `idx_asig_created_at` (con `WHERE deleted_at IS NULL` donde aplique)
    - Índices de búsqueda por texto: `CREATE EXTENSION IF NOT EXISTS pg_trgm` + índices GIN trigram sobre `LOWER(serie)`, `LOWER(modelo)`, `LOWER(nombre)`
    - Índice único parcial `uq_asig_una_activa ON asignaciones(serie_activo) WHERE estado = 'activa'` (blindaje de última línea contra doble asignación)
    - `ALTER TABLE asignaciones ADD COLUMN IF NOT EXISTS confirmado_via VARCHAR(50)`
    - Tabla `sesiones_revocadas (jti VARCHAR(64) PRIMARY KEY, expira_at TIMESTAMP NOT NULL)` + `idx_sesiones_revocadas_exp`
    - Todo idempotente (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), coherente con el estilo de migraciones existente
    - _Requisitos: 9.1, 9.4, 7.1, 11.5, 14.1_

  - [x] 3.2 Registrar/ejecutar la migración con el runner existente
    - Integrar `006_mejoras_integrales.sql` en el mecanismo de `backend/migrations/run_migration.js` (o el flujo de migrado vigente) sin romper migraciones previas
    - _Requisitos: 9.4, 11.5_

- [x] 4. Centralizar el ciclo de vida de Asignaciones en un módulo transaccional
  - [x] 4.1 Crear `backend/db/asignaciones.js` con `crearAsignacion` transaccional
    - `BEGIN`; `SELECT ... FOR UPDATE` sobre el activo; validar existencia de activo y colaborador (404 vía `ApiError.notFound`); rechazar si ya hay asignación `activa` (409 vía `ApiError.conflict`, traduciendo también la violación de `uq_asig_una_activa`)
    - En éxito: `INSERT asignaciones (estado='activa')`, `UPDATE activos SET estado='Asignado', rut_responsable=rut`, `INSERT historial_activos (tipo='asignacion')`; `COMMIT`
    - `try/catch/finally` con `ROLLBACK` ante excepción y `client.release()` siempre
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 14.1_

  - [x] 4.2 Escribir prueba de propiedad para el rechazo de doble asignación activa
    - **Property 13: Rechazo de doble asignación activa**
    - **Valida: Requisitos 7.1**
    - Mock del `client` de pg; verificar 409, no creación y que el conteo de activas permanece en 1
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.3 Escribir prueba de propiedad para referencias inexistentes
    - **Property 14: Rechazo de referencias inexistentes en Asignacion**
    - **Valida: Requisitos 7.2**
    - Generar pares (serie, rut) con al menos una entidad ausente; verificar 404 y no creación
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.4 Escribir prueba de propiedad para la postcondición atómica de creación
    - **Property 15: Postcondición atómica de creación de Asignacion (consistencia)**
    - **Valida: Requisitos 7.3, 14.1**
    - Verificar estado `Asignado`, `rut_responsable` = rut del colaborador y entrada de historial `asignacion`
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.5 Implementar `cerrarAsignacion` transaccional en `backend/db/asignaciones.js`
    - `BEGIN`; validar asignación `activa` existente (404 si no); registrar fecha fin, motivo y estado físico; `UPDATE activos` dejando `rut_responsable` nulo y estado físico registrado; `INSERT historial_activos (tipo='devolucion')`
    - Generación condicional de token: si hay correo del colaborador o `correo_alterno` → estado `pendiente_firma` + `token_confirmacion` con `token_expira_at` = ahora + 72h; si no hay correo → estado `cerrada` sin token
    - Si `desvincular_colaborador` → `UPDATE colaboradores SET activo=false` dentro de la misma transacción
    - `COMMIT`; `try/catch/finally` con `ROLLBACK` y `client.release()`
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 14.2, 14.4, 14.5_

  - [x] 4.6 Escribir prueba de propiedad para la postcondición atómica de cierre
    - **Property 16: Postcondición atómica de cierre de Asignacion**
    - **Valida: Requisitos 8.1, 14.2**
    - Verificar activo sin responsable, estado físico registrado y entrada de historial `devolucion`
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.7 Escribir prueba de propiedad para la generación condicional de token
    - **Property 18: Generación condicional de Token_Confirmacion al cerrar**
    - **Valida: Requisitos 8.3, 8.4**
    - Con correo → `pendiente_firma` + token vigente 72h; sin correo → `cerrada` sin token
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.8 Escribir prueba de propiedad para la marca de colaborador inactivo
    - **Property 32: Marca de colaborador inactivo al desvincular en el cierre**
    - **Valida: Requisitos 14.4**
    - Con `desvincular_colaborador` activo, verificar colaborador inactivo dentro de la misma transacción
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.9 Escribir prueba de propiedad para el rollback total ante fallo
    - **Property 17: Rollback total ante fallo de una operación de Asignacion**
    - **Valida: Requisitos 7.4, 8.2, 14.5**
    - Mock del `client` que inyecta fallo en un paso arbitrario; verificar que activo/asignación/colaborador quedan idénticos al estado previo
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.10 Implementar `confirmarFirma(token)` transaccional en `backend/db/asignaciones.js`
    - Token vigente en `pendiente_firma` → registrar `confirmado_at`, estado `cerrada`, invalidar token (404 en reuso)
    - Token inexistente o ya usado → señal 404 sin modificar estado
    - Token vencido (>72h) → señal 410 sin modificar estado
    - _Requisitos: 8.5, 8.6, 8.7_

  - [x] 4.11 Escribir pruebas de propiedad para la confirmación de Firma_Digital
    - **Property 19: Confirmación de Firma_Digital con token vigente e invalidación** — **Valida: Requisitos 8.5**
    - **Property 20: Token de confirmación inexistente o usado no altera estado** — **Valida: Requisitos 8.6**
    - **Property 21: Token de confirmación vencido no altera estado** — **Valida: Requisitos 8.7**
    - Tokens con vigencia variable; verificar transiciones, invalidación y códigos 404/410
    - Ubicación: `backend/__tests__/asignaciones.test.js`

  - [x] 4.12 Implementar `getAsignaciones` con filtros combinados y paginación
    - Filtros por estado, serie de activo y RUT de colaborador (conjunción) resueltos sobre columnas indexadas; `LEFT JOIN`/`json_build_object` para evitar N+1; `COUNT(*) OVER()` para el total; usar `parsePagination`
    - _Requisitos: 6.3, 9.2, 9.4, 9.5_

  - [x] 4.13 Escribir prueba de propiedad para los filtros combinados de asignaciones
    - **Property 12: Filtros combinados de Asignaciones**
    - **Valida: Requisitos 6.3**
    - Conjuntos y combinaciones de filtros aleatorios; verificar conjunción exacta
    - Ubicación: `backend/__tests__/asignaciones.test.js`

- [x] 5. Controlador delgado de asignaciones + validación Zod uniforme
  - [x] 5.1 Añadir esquemas Zod de asignaciones a `backend/schemas.js`
    - `createAsignacionSchema` (`serie_activo`, `rut_colaborador` con `rutSchema`, `entregado_por?`, `notas?`)
    - `cerrarAsignacionSchema` (`motivo_devolucion?`, `estado_fisico_devolucion` enum, `desvincular_colaborador?`, `correo_alterno?` email)
    - _Requisitos: 12.1_

  - [x] 5.2 Refactorizar `backend/routes/asignaciones.js` a controlador delgado
    - Aplicar `validate(createAsignacionSchema)` / `validate(cerrarAsignacionSchema)` como middleware (reemplazar validación manual)
    - Delegar en `db/asignaciones.js` (`crearAsignacion`, `cerrarAsignacion`, `confirmarFirma`, `getAsignaciones`); pasar errores con `next(ApiError...)`
    - Aplicar `requireAdmin` a crear/cerrar (viewer → 403); `GET /confirmar/:token` sigue siendo público y responde **HTML** 200/404/410
    - _Requisitos: 6.3, 7.1, 7.2, 7.5, 8.5, 8.6, 8.7, 12.1_

  - [x] 5.3 Eliminar el doble camino de asignación en `backend/db/activos.js`
    - Que `updateActivo` deje de crear/cerrar asignaciones fuera de transacción; cuando cambie `rut_responsable` desde la ficha, redirigir a las funciones transaccionales de `db/asignaciones.js`
    - _Requisitos: 14.1, 14.2, 14.5_

  - [x] 5.4 Escribir pruebas de integración de los flujos de asignación (Req. 13.4)
    - Creación: éxito (201) + errores (409 ya asignado, 404 entidad inexistente, 403 viewer)
    - Cierre: éxito (con y sin correo) + errores (404 activa inexistente, 403 viewer)
    - Confirmación de Firma_Digital: éxito (token vigente) + errores (404 inexistente/usado, 410 vencido)
    - Incluir al menos una prueba contra BD PostgreSQL de prueba para validar el `ROLLBACK` real y el índice único parcial
    - _Requisitos: 13.4_
    - Ubicación: `backend/__tests__/asignaciones.integration.test.js`

- [x] 6. Checkpoint — asegurar que las pruebas del backend de asignaciones pasan
  - Asegúrate de que todas las pruebas pasen; pregunta al usuario si surgen dudas.

- [x] 7. Validación de RUT y campos obligatorios de Activo
  - [x] 7.1 Consolidar/verificar `rutSchema` y `createActivoSchema` en `backend/schemas.js`
    - Asegurar que `validarRut` valida formato + dígito verificador y que `createActivoSchema` exige `serie, marca, modelo, estado, tipo_dispositivo` con mensaje que nombra cada campo faltante
    - _Requisitos: 1.4, 2.2_

  - [x] 7.2 Escribir prueba de propiedad para el rechazo de campos obligatorios
    - **Property 1: Rechazo de campos obligatorios faltantes en Activo**
    - **Valida: Requisitos 1.4**
    - Generar activos con al menos un obligatorio omitido; verificar 400 y que el mensaje nombra cada faltante
    - Ubicación: `backend/__tests__/schemas.test.js`

  - [x] 7.3 Escribir prueba de propiedad para la validación de RUT
    - **Property 3: Validación de RUT por dígito verificador**
    - **Valida: Requisitos 2.2**
    - Cuerpos con DV correcto/incorrecto; aceptar si y solo si el DV es válido, rechazar con 400 en otro caso
    - Ubicación: `backend/__tests__/schemas.test.js`

- [x] 8. Paginación y anti-N+1 en listados de Activos y Colaboradores
  - [x] 8.1 Añadir paginación y filtros indexados a `backend/db/activos.js#getActivos`
    - Usar `parsePagination`; `LEFT JOIN LATERAL` sobre `asignaciones` (estado `activa`) para la asignación vigente sin consulta por fila; `COUNT(*) OVER()` para el total; orden `created_at DESC`
    - Respuesta `{ data, pagination }`
    - _Requisitos: 9.2, 9.3, 9.4, 9.5_

  - [x] 8.2 Añadir paginación y filtros indexados a `backend/db/colaboradores.js#getColaboradores`
    - `parsePagination`; total con `COUNT(*) OVER()`; exponer `total_activos` (conteo de activos asignados) por colaborador
    - Actualizar `backend/routes/activos.js` y `backend/routes/colaboradores.js` para devolver `{ data, pagination }`
    - _Requisitos: 2.5, 9.2, 9.3, 9.4, 9.5_

  - [x] 8.3 Escribir prueba de propiedad para el conteo de activos asignados
    - **Property 4: Conteo de activos asignados de un Colaborador**
    - **Valida: Requisitos 2.5**
    - Backing data con mock de query; verificar que el conteo = nº de activos no eliminados con ese RUT y estado `Asignado`
    - Ubicación: `backend/__tests__/colaboradores.test.js`

  - [x] 8.4 Verificar orden y forma del historial en `backend/db/historial.js`
    - Asegurar orden `created_at DESC` y que cada entrada incluye tipo, fecha, RUT anterior/nuevo, estado anterior/nuevo y notas
    - _Requisitos: 3.3, 3.4_

  - [x] 8.5 Escribir pruebas de propiedad para el historial
    - **Property 5: Orden cronológico descendente del historial** — **Valida: Requisitos 3.3**
    - **Property 6: Completitud de forma de cada entrada de historial** — **Valida: Requisitos 3.4**
    - Movimientos aleatorios; verificar orden no creciente por fecha y presencia de todos los campos
    - Ubicación: `backend/__tests__/historial.test.js`

  - [x] 8.6 Función de detección de inconsistencia estado/asignación
    - Implementar helper (`db/asignaciones.js` o `lib/`) que marca un activo inconsistente si y solo si su estado es `Asignado` y no existe asignación `activa`; exponerlo en el payload de la Ficha_Activo
    - _Requisitos: 14.3_

  - [x] 8.7 Escribir prueba de propiedad para la detección de inconsistencia
    - **Property 33: Detección de inconsistencia estado/asignación**
    - **Valida: Requisitos 14.3**
    - Activos/asignaciones aleatorios; verificar la equivalencia "inconsistente ⟺ Asignado sin activa"
    - Ubicación: `backend/__tests__/consistencia.test.js`

- [x] 9. Seguridad de sesión: denylist de logout
  - [x] 9.1 Emitir JWT con `jti` y revocar en logout
    - Incluir `jti` (UUID) al firmar el token en `backend/routes/auth.js`
    - En logout: insertar `jti` + `expira_at` en `sesiones_revocadas` y limpiar la cookie
    - Sanear la respuesta de login/perfil con `lib/sanitizeUsuario.js`
    - _Requisitos: 11.5, 12.4_

  - [x] 9.2 Rechazar tokens revocados en `backend/middleware.js#authenticate`
    - Devolver 401 (`ApiError.unauthorized`) si el `jti` del token está en la denylist vigente; mantener 401 para token ausente/inválido/expirado
    - Añadir limpieza periódica de entradas vencidas de `sesiones_revocadas`
    - _Requisitos: 11.1, 11.2, 11.5_

  - [x] 9.3 Escribir prueba de propiedad para la revocación de sesión tras logout
    - **Property 27: Revocación de sesión tras logout**
    - **Valida: Requisitos 11.5**
    - Round-trip: emitir → usar (200) → logout → reusar (401)
    - Ubicación: `backend/__tests__/auth.test.js`

- [x] 10. Checkpoint — asegurar que toda la suite del backend pasa
  - Asegúrate de que todas las pruebas pasen; pregunta al usuario si surgen dudas.

- [x] 11. Utilidades y hooks transversales del frontend
  - [x] 11.1 Crear helper de completitud `Interfaz_Web/src/utils/completitud.js`
    - Calcular % de `Campos_Recomendados` no vacíos según tipo de dispositivo (base + móviles Smartphone/Tablet/SIM Card); resultado en [0,100]
    - _Requisitos: 1.5, 2.5_

  - [x] 11.2 Escribir prueba de propiedad para el indicador de completitud
    - **Property 2: Rango y monotonía del indicador de completitud**
    - **Valida: Requisitos 1.5, 2.5**
    - Activos aleatorios; verificar rango [0,100], monotonía al completar un campo y 100 con todos los recomendados aplicables
    - Ubicación: `Interfaz_Web/src/utils/__tests__/completitud.test.js`

  - [x] 11.3 Crear hook `useDebouncedValue(value, 300)` en `Interfaz_Web/src/hooks/`
    - Colapsar ráfagas dentro de 300 ms y emitir el último valor
    - _Requisitos: 10.3_

  - [x] 11.4 Escribir prueba de propiedad para el debounce de búsqueda
    - **Property 26: Debounce de búsqueda colapsa ráfagas**
    - **Valida: Requisitos 10.3**
    - Timers falsos + ráfagas aleatorias dentro de 300 ms; verificar a lo sumo una emisión con el último valor
    - Ubicación: `Interfaz_Web/src/hooks/__tests__/useDebouncedValue.test.js`

  - [x] 11.5 Crear hook `useSubmit()` en `Interfaz_Web/src/hooks/`
    - Exponer `isSubmitting`; deshabilitar el disparador mientras la promesa está pendiente; `AbortController` con timeout de 30 s; al expirar, retirar spinner y emitir error "la operación no pudo confirmarse"; preservar datos del formulario ante error de API
    - _Requisitos: 5.2, 5.3, 5.4_

  - [x] 11.6 Escribir pruebas de propiedad para el control de envío
    - **Property 8: Preservación de datos del formulario ante error de API** — **Valida: Requisitos 5.2**
    - **Property 9: Antirreenvío de operación en curso** — **Valida: Requisitos 5.3**
    - Estados de formulario aleatorios + timers falsos; verificar preservación de datos y ausencia de reenvío mientras está en curso
    - Ubicación: `Interfaz_Web/src/hooks/__tests__/useSubmit.test.js`

- [x] 12. Caché e invalidación del store (Zustand)
  - [x] 12.1 Añadir banderas `dirty` por dominio en `Interfaz_Web/src/store/`
    - `activosDirty`, `colaboradoresDirty`, `asignacionesDirty`; lecturas reutilizan datos si no está `dirty`; escrituras marcan `dirty=true`; adaptar los consumidores a `{ data, pagination }`
    - _Requisitos: 10.1, 10.2_

  - [x] 12.2 Escribir pruebas de propiedad para la caché del store
    - **Property 24: Reutilización de datos no invalidados del store** — **Valida: Requisitos 10.1**
    - **Property 25: Recarga tras invalidación por escritura** — **Valida: Requisitos 10.2**
    - Espiar el cliente API; verificar cero solicitudes cuando no está `dirty` y exactamente una tras invalidación (limpiando la marca)
    - Ubicación: `Interfaz_Web/src/store/__tests__/store.test.js`

- [x] 13. Fichas de detalle enriquecidas
  - [x] 13.1 Crear `Interfaz_Web/src/components/CompletitudBadge.jsx`
    - Ícono de advertencia + color de alerta + texto para `Campo_Recomendado` vacío
    - _Requisitos: 1.3, 2.3_

  - [x] 13.2 Enriquecer la Ficha_Activo (`components/FichaActivo`)
    - Mostrar todos los campos por tipo de dispositivo; campos móviles condicionales (Smartphone/Tablet/SIM Card); indicador de completitud %; badges de campo incompleto; asignación vigente (responsable, fecha inicio, quién entregó) o estado disponible; historial descendente; badge de inconsistencia estado/asignación
    - _Requisitos: 1.1, 1.2, 1.3, 1.5, 3.1, 3.2, 3.3, 3.4, 14.3_

  - [x] 13.3 Enriquecer la Ficha_Colaborador (`components/FichaColaborador`)
    - RUT, nombre, correo, área, cargo, teléfono, estado; aviso de correo faltante (impide Firma_Digital por correo); contador de activos asignados
    - _Requisitos: 2.1, 2.3, 2.5_

- [x] 14. Navegación, feedback y estados de la interfaz
  - [x] 14.1 Crear `components/Breadcrumb.jsx` y reforzar `Sidebar`
    - Breadcrumb ≥2 niveles con el listado de origen navegable conservando filtros; `aria-current="page"` en el item activo del `Sidebar`
    - _Requisitos: 4.1, 4.2, 4.3_

  - [x] 14.2 Crear `components/Toast.jsx` + `useFeedback` y `components/ConfirmDialog.jsx`
    - Confirmación con tipo + entidad por identificador visible; error legible que preserva datos; diálogo de borrado que nombra la entidad y solo dispara el endpoint al confirmar
    - _Requisitos: 5.1, 5.2, 5.5_

  - [x] 14.3 Escribir prueba de propiedad para la confirmación de eliminación
    - **Property 10: Confirmación previa obligatoria para eliminación**
    - **Valida: Requisitos 5.5**
    - Verificar que sin confirmación no se invoca el endpoint de borrado y que solo se envía al confirmar
    - Ubicación: `Interfaz_Web/src/components/__tests__/ConfirmDialog.test.jsx`

  - [x] 14.4 Crear `components/EmptyState.jsx` y `components/ErrorRetry.jsx`
    - Estado vacío con explicación + acción principal (incluye listado de asignaciones sin resultados); error de red con botón "Reintentar" que reejecuta la carga
    - _Requisitos: 6.4, 15.1, 15.2_

  - [x] 14.5 Crear `components/Stepper.jsx` (flujos multi-paso)
    - Pasos numerados desde 1, paso actual visible, navegable por teclado; aplicarlo a los flujos de asignación/devolución
    - _Requisitos: 4.5, 15.4_

- [x] 15. Control por rol y accesibilidad
  - [x] 15.1 Ocultar/deshabilitar controles de escritura para rol `viewer`
    - En listados y fichas, ocultar o deshabilitar crear/editar/asignar/devolver para `viewer` sin permitir su activación
    - _Requisitos: 4.4_

  - [x] 15.2 Escribir prueba de propiedad para controles del viewer
    - **Property 7: Ningún control de escritura habilitado para viewer**
    - **Valida: Requisitos 4.4**
    - Render con rol `viewer`; verificar que no existe ningún control de escritura habilitado
    - Ubicación: `Interfaz_Web/src/__tests__/roles.test.jsx`

  - [x] 15.3 Etiquetas accesibles y navegación por teclado en formularios
    - `label`/`htmlFor` o `aria-label`/`aria-labelledby` en cada control; asegurar envío por teclado en creación/asignación/devolución; verificar layout sin overflow horizontal ≤768 px
    - _Requisitos: 15.3, 15.4, 15.5_

  - [x] 15.4 Escribir prueba de propiedad para etiquetas accesibles
    - **Property 34: Etiqueta accesible en cada control de formulario**
    - **Valida: Requisitos 15.3**
    - Recorrer los controles de cada formulario y verificar que todos tienen etiqueta accesible asociada
    - Ubicación: `Interfaz_Web/src/__tests__/a11y.test.jsx`

  - [x] 15.5 Mostrar el ciclo de vida de la Asignacion en la Interfaz_Web
    - Mostrar el estado (activa/pendiente_firma/cerrada/cancelada); aviso visible en `pendiente_firma`; en `cerrada` mostrar fecha inicio/fin, motivo, estado físico y fecha de confirmación de firma cuando exista
    - _Requisitos: 6.1, 6.2, 6.5_

  - [x] 15.6 Escribir prueba de propiedad para el estado válido de Asignacion en UI
    - **Property 11: Estado de Asignacion dentro del conjunto válido**
    - **Valida: Requisitos 6.1**
    - Verificar que el estado renderizado es exactamente uno del conjunto válido
    - Ubicación: `Interfaz_Web/src/__tests__/asignacionEstado.test.jsx`

- [x] 16. Checkpoint final — asegurar que backend y frontend pasan
  - Asegúrate de que todas las pruebas pasen (backend `jest --ci` sin watch, frontend `vitest run`) y el linter reporte cero errores; pregunta al usuario si surgen dudas.
  - _Requisitos: 13.1, 13.3_

## Notes

- Las tareas marcadas con `*` son opcionales (principalmente pruebas y funcionalidades de menor prioridad) y pueden omitirse para un MVP o una ejecución escalonada. Las tareas de implementación núcleo nunca están marcadas como opcionales.
- Cada tarea referencia sus requisitos y, cuando corresponde, la propiedad de corrección que valida (por número).
- El trabajo es evolutivo/correctivo sobre un sistema en producción: se preservan contratos y se migran los consumidores dentro del mismo bloque de cambio; nada se reescribe desde cero.
- Las 34 correctness properties del diseño se implementan con `fast-check` (≥100 iteraciones cada una) y cada prueba referencia su propiedad por comentario.
- Los flujos de asignación/cierre/firma cuentan además con pruebas de integración (Req. 13.4), incluida al menos una contra PostgreSQL de prueba para validar el `ROLLBACK` real y el índice único parcial.
- Rendimiento (Req. 9.1), N+1 (Req. 9.5), índices (Req. 9.4), responsive (Req. 15.5) y linter (Req. 13.1) se validan con benchmarks/`EXPLAIN`/render/eslint según la Testing Strategy del diseño.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.5", "1.7", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.6", "1.8", "2.1", "3.2", "7.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "4.5", "4.10", "4.12", "7.2", "7.3", "8.4", "8.6", "9.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.6", "4.7", "4.8", "4.9", "4.11", "4.13", "8.1", "8.2", "8.5", "8.7", "9.2", "9.3"] },
    { "id": 4, "tasks": ["5.1", "5.3", "8.3"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["5.4"] },
    { "id": 7, "tasks": ["11.1", "11.3", "11.5", "12.1"] },
    { "id": 8, "tasks": ["11.2", "11.4", "11.6", "12.2", "13.1"] },
    { "id": 9, "tasks": ["13.2", "13.3", "14.1", "14.2", "14.4", "14.5", "15.1", "15.5"] },
    { "id": 10, "tasks": ["14.3", "15.2", "15.3", "15.6"] },
    { "id": 11, "tasks": ["15.4"] }
  ]
}
```
