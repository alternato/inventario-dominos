# Requirements Document

## Introduction

Este documento define los requisitos para la mejora, reparación y optimización integral del sistema **IT COMPASS**, la aplicación web de Inventario TI de Domino's Pizza Chile. El sistema es full-stack: backend Node.js/Express con PostgreSQL (Docker) y frontend React 18 (Vite, Zustand, Tailwind), con autenticación local (JWT en cookie httpOnly) y Microsoft MSAL, además de un agente de IA basado en Claude.

El sistema gira en torno a tres ejes de negocio: **Activos** (equipos TI), **Colaboradores** (empleados identificados por RUT) y **Asignaciones** (ciclo de vida de entrega/devolución con firma digital por correo). La revisión es priorizada por impacto y cubre cinco frentes: rendimiento y optimización, seguridad, calidad de código y mantenibilidad, corrección de errores conocidos, y experiencia de usuario (UX/UI).

El foco principal, según lo expresado por el usuario, está en resolver la sensación de que "falta información, orden en los flujos y orden en las asignaciones". Por eso las primeras secciones abordan completitud de datos, claridad de flujos y trazabilidad/orden de las asignaciones, seguidas de los ejes transversales de la revisión integral.

Este documento se centra en el **qué** (comportamiento observable y verificable) y no en el **cómo** (decisiones de implementación quedan para la fase de diseño).

## Glossary

- **Sistema_Inventario**: La aplicación IT COMPASS considerada como un todo (frontend + backend + base de datos).
- **API_Backend**: El servicio Node.js/Express que expone los endpoints REST.
- **Interfaz_Web**: El cliente frontend React que consume la API_Backend.
- **Activo**: Equipo TI registrado, identificado de forma única por su número de serie. Estados válidos: Asignado, Disponible, Mantenimiento, Descartado.
- **Colaborador**: Empleado identificado de forma única por su RUT.
- **Asignacion**: Registro del ciclo de vida de la entrega de un Activo a un Colaborador. Estados válidos: activa, pendiente_firma, cerrada, cancelada.
- **Historial_Movimientos**: Registro cronológico de movimientos de un Activo (asignación, devolución, cambio de estado, creación, baja, reparación).
- **Ficha_Activo**: Vista de detalle que consolida todos los datos de un Activo, su asignación vigente y su historial.
- **Ficha_Colaborador**: Vista de detalle que consolida los datos de un Colaborador y los Activos que tiene asignados.
- **Firma_Digital**: Confirmación de devolución realizada por el Colaborador a través de un enlace único enviado por correo.
- **Token_Confirmacion**: Token único con vigencia de 72 horas usado para la Firma_Digital de una devolución.
- **Usuario_Operador**: Persona autenticada que opera el Sistema_Inventario. Roles: viewer, admin, superadministrador.
- **RUT**: Rol Único Tributario chileno; identificador único de un Colaborador.
- **Campo_Obligatorio**: Campo cuya ausencia impide guardar o completar un registro.
- **Campo_Recomendado**: Campo relevante para la completitud del dato cuya ausencia no bloquea el guardado pero se señala visualmente.

## Requirements

---

## Grupo A — Completitud de la información (Activos y Colaboradores)

### Requirement 1: Completitud de datos de un Activo

**User Story:** Como Usuario_Operador, quiero que la ficha de un Activo muestre y capture todos sus datos relevantes de forma completa, para dejar de sentir que falta información sobre cada equipo.

#### Acceptance Criteria

1. WHEN un Usuario_Operador abre la Ficha_Activo de un Activo, THE Interfaz_Web SHALL mostrar todos los campos definidos para el tipo de dispositivo del Activo, incluyendo serie, marca, modelo, estado, tipo de dispositivo, ubicación, observaciones, fecha de compra, valor, número de factura y responsable actual.
2. WHERE el tipo de dispositivo del Activo es Smartphone, Tablet o SIM Card, THE Interfaz_Web SHALL mostrar los campos IMEI, número SIM, IMSI, número de teléfono y compañía.
3. IF un Campo_Recomendado de un Activo está vacío, THEN THE Interfaz_Web SHALL marcar el campo con un indicador visual distintivo (ícono de advertencia y color de alerta) acompañado de un texto que indique que el campo está incompleto, sin bloquear la visualización de la ficha.
4. WHEN un Usuario_Operador guarda un Activo sin un Campo_Obligatorio, THE API_Backend SHALL rechazar la operación con un código de estado 400 y un mensaje que identifique cada campo faltante.
5. THE Sistema_Inventario SHALL calcular y mostrar en la Ficha_Activo un indicador de completitud expresado como porcentaje de Campos_Recomendados con valor no vacío.

### Requirement 2: Completitud de datos de un Colaborador

**User Story:** Como Usuario_Operador, quiero que la ficha de un Colaborador muestre y capture sus datos de identificación y contacto de forma completa, para saber a quién pertenece cada equipo y cómo contactarlo.

#### Acceptance Criteria

1. WHEN un Usuario_Operador abre la Ficha_Colaborador, THE Interfaz_Web SHALL mostrar RUT, nombre, correo, área, cargo, teléfono y estado (activo/inactivo).
2. WHEN un Usuario_Operador guarda un Colaborador con un RUT que no cumple el formato del RUT chileno con dígito verificador válido, THE API_Backend SHALL rechazar la operación con código 400 y un mensaje que indique que el RUT es inválido.
3. IF un Colaborador no tiene correo registrado, THEN THE Interfaz_Web SHALL marcar la ausencia de correo con un indicador visual distintivo (ícono de advertencia y color de alerta) acompañado de un texto que indique que la Firma_Digital de devolución no podrá enviarse por correo corporativo.
4. WHEN un Usuario_Operador intenta guardar un Colaborador con un RUT ya existente, THE API_Backend SHALL rechazar la operación con código 409 y un mensaje que indique que el RUT ya está registrado.
5. THE Ficha_Colaborador SHALL mostrar la cantidad de Activos actualmente asignados al Colaborador.

### Requirement 3: Enriquecimiento de la Ficha_Activo con contexto de asignación e historial

**User Story:** Como Usuario_Operador, quiero ver en un solo lugar el estado de asignación de un Activo y su historial de movimientos, para entender la situación completa del equipo sin navegar entre pantallas.

#### Acceptance Criteria

1. WHEN un Usuario_Operador abre la Ficha_Activo, THE Interfaz_Web SHALL mostrar la Asignacion vigente del Activo cuando exista, incluyendo Colaborador responsable, fecha de inicio y quién entregó el equipo.
2. WHERE el Activo no tiene una Asignacion en estado activa, THE Interfaz_Web SHALL mostrar de forma explícita que el Activo está disponible o en el estado que corresponda.
3. WHEN un Usuario_Operador abre la Ficha_Activo, THE Interfaz_Web SHALL mostrar el Historial_Movimientos del Activo ordenado de forma cronológica descendente.
4. THE Historial_Movimientos mostrado SHALL incluir por cada entrada el tipo de movimiento, la fecha, el RUT anterior, el RUT nuevo, el estado anterior, el estado nuevo y las notas asociadas.

---

## Grupo B — Orden y claridad en los flujos de trabajo

### Requirement 4: Navegación y estructura de flujos clara

**User Story:** Como Usuario_Operador, quiero una navegación coherente que me indique dónde estoy y qué acciones puedo tomar, para dejar de sentir que los flujos están desordenados.

#### Acceptance Criteria

1. WHILE un Usuario_Operador navega por la Interfaz_Web, THE Interfaz_Web SHALL resaltar visualmente el elemento del menú de navegación correspondiente a la sección activa, de forma distinta a los elementos no activos.
2. WHEN un Usuario_Operador se encuentra en una vista de detalle, THE Interfaz_Web SHALL mostrar una ruta de navegación (breadcrumb) con al menos dos niveles (listado de origen y detalle actual) en la que el nivel del listado de origen sea seleccionable.
3. WHEN un Usuario_Operador selecciona el nivel del listado de origen en el breadcrumb, THE Interfaz_Web SHALL navegar a la vista de listado de origen conservando los filtros aplicados previamente.
4. WHERE el rol del Usuario_Operador es viewer, THE Interfaz_Web SHALL ocultar los controles de creación, edición, asignación y devolución, o mostrarlos en estado deshabilitado sin permitir su activación.
5. WHEN una acción del Usuario_Operador requiere dos o más pasos, THE Interfaz_Web SHALL presentar los pasos numerados secuencialmente desde 1 e indicar de forma visible el número del paso actual.

### Requirement 5: Retroalimentación de estado de las operaciones

**User Story:** Como Usuario_Operador, quiero recibir confirmación clara del resultado de cada acción, para saber si una operación se completó o falló.

#### Acceptance Criteria

1. WHEN una operación de creación, edición o eliminación se completa con éxito, THE Interfaz_Web SHALL mostrar un mensaje de confirmación que identifique el tipo de operación realizada y la entidad afectada por su identificador visible.
2. IF una operación falla por un error reportado por la API_Backend, THEN THE Interfaz_Web SHALL mostrar un mensaje de error legible que describa la causa reportada por la API_Backend y SHALL conservar los datos ingresados por el Usuario_Operador sin descartarlos.
3. WHILE una operación está en curso, THE Interfaz_Web SHALL mostrar un indicador de carga y SHALL impedir el reenvío de la misma operación hasta que se reciba la respuesta de la API_Backend o transcurran 30 segundos sin respuesta.
4. IF una operación en curso no recibe respuesta de la API_Backend dentro de 30 segundos, THEN THE Interfaz_Web SHALL retirar el indicador de carga y SHALL mostrar un mensaje de error indicando que la operación no pudo confirmarse.
5. WHEN una operación de eliminación es solicitada, THE Interfaz_Web SHALL requerir una confirmación explícita del Usuario_Operador que identifique la entidad a eliminar antes de enviar la solicitud a la API_Backend, y SHALL cancelar la operación si el Usuario_Operador no confirma.

---

## Grupo C — Orden y trazabilidad de las Asignaciones

### Requirement 6: Visibilidad del ciclo de vida de una Asignacion

**User Story:** Como Usuario_Operador, quiero ver claramente el estado de cada Asignacion dentro de su ciclo de vida, para tener orden y control sobre las entregas y devoluciones.

#### Acceptance Criteria

1. WHEN un Usuario_Operador visualiza una Asignacion, THE Interfaz_Web SHALL mostrar su estado actual como exactamente uno de los siguientes valores: activa, pendiente_firma, cerrada o cancelada.
2. WHILE una Asignacion está en estado pendiente_firma, THE Interfaz_Web SHALL indicar de forma visible que la devolución está a la espera de la Firma_Digital del Colaborador.
3. WHEN un Usuario_Operador aplica uno o más filtros sobre el listado de Asignaciones por estado, por serie de Activo o por RUT de Colaborador, THE Interfaz_Web SHALL mostrar únicamente las Asignaciones que cumplan todos los filtros aplicados.
4. IF un filtro aplicado sobre el listado de Asignaciones no arroja resultados, THEN THE Interfaz_Web SHALL mostrar un mensaje indicando que no existen Asignaciones que cumplan los criterios seleccionados.
5. WHEN un Usuario_Operador visualiza una Asignacion en estado cerrada, THE Interfaz_Web SHALL mostrar la fecha de inicio, la fecha de fin, el motivo de devolución y el estado físico de devolución, y SHALL mostrar la fecha de confirmación de la Firma_Digital cuando dicha confirmación exista.

### Requirement 7: Integridad del flujo de asignación

**User Story:** Como Usuario_Operador administrador, quiero que el sistema impida asignaciones inconsistentes, para mantener el orden y evitar equipos con doble responsable.

#### Acceptance Criteria

1. WHEN un Usuario_Operador con rol admin o superadministrador crea una Asignacion para un Activo que ya tiene una Asignacion en estado activa, THE API_Backend SHALL rechazar la operación con código 409, no crear la nueva Asignacion y devolver un mensaje que indique que el equipo ya está asignado.
2. IF la serie de Activo o el RUT de Colaborador de una nueva Asignacion no existen, THEN THE API_Backend SHALL rechazar la operación con código 404, no crear la Asignacion y devolver un mensaje que identifique cuál entidad falta.
3. WHEN una Asignacion se crea con éxito, THE API_Backend SHALL registrar la operación de forma atómica actualizando el estado del Activo a Asignado, asignando el responsable y creando la entrada correspondiente en el Historial_Movimientos, de modo que los tres cambios se apliquen en su totalidad o ninguno se aplique.
4. IF cualquier paso del registro atómico de una Asignacion falla, THEN THE API_Backend SHALL revertir todos los cambios de esa operación, dejar el estado del Activo y del Historial_Movimientos como estaban antes de la operación y devolver un mensaje de error indicando que la Asignacion no se completó.
5. WHERE un Usuario_Operador tiene rol viewer, THE API_Backend SHALL rechazar las solicitudes de creación y cierre de Asignaciones con código 403 sin aplicar cambio alguno.

### Requirement 8: Flujo de devolución y Firma_Digital

**User Story:** Como Usuario_Operador administrador, quiero un flujo de devolución ordenado con confirmación del colaborador, para tener respaldo trazable de cada devolución.

#### Acceptance Criteria

1. WHEN un Usuario_Operador cierra una Asignacion en estado activa, THE API_Backend SHALL registrar de forma atómica la fecha de fin, el motivo de devolución y el estado físico, actualizar el estado del Activo y crear la entrada de devolución en el Historial_Movimientos, de modo que todos los cambios se apliquen en su totalidad o ninguno se aplique.
2. IF cualquier paso del cierre atómico de una Asignacion falla, THEN THE API_Backend SHALL revertir todos los cambios de esa operación y devolver un mensaje de error indicando que la devolución no se completó.
3. WHERE el Colaborador tiene correo registrado o se proporciona un correo alterno al cerrar la Asignacion, THE API_Backend SHALL generar un Token_Confirmacion con vigencia de 72 horas contadas desde su generación y dejar la Asignacion en estado pendiente_firma.
4. WHERE no existe correo del Colaborador ni correo alterno al cerrar la Asignacion, THE API_Backend SHALL dejar la Asignacion en estado cerrada sin generar Token_Confirmacion ni requerir Firma_Digital.
5. WHEN un Colaborador accede a un enlace de confirmación con un Token_Confirmacion vigente, THE API_Backend SHALL registrar la fecha de confirmación, cambiar el estado de la Asignacion a cerrada e invalidar el Token_Confirmacion para impedir su reutilización.
6. IF un enlace de confirmación se accede con un Token_Confirmacion inexistente o ya utilizado, THEN THE API_Backend SHALL responder con código 404 y una página que indique que el enlace no es válido, sin modificar el estado de ninguna Asignacion.
7. IF un enlace de confirmación se accede después de vencido el plazo de 72 horas, THEN THE API_Backend SHALL responder con código 410 y una página que indique que el enlace expiró, sin modificar el estado de ninguna Asignacion.

---

## Grupo D — Rendimiento y optimización

### Requirement 9: Rendimiento de listados y consultas

**User Story:** Como Usuario_Operador, quiero que los listados carguen con rapidez incluso con muchos registros, para trabajar con fluidez.

#### Acceptance Criteria

1. WHEN un Usuario_Operador solicita un listado de Activos, Colaboradores o Asignaciones, THE API_Backend SHALL responder en un tiempo igual o menor a 800 ms (percentil 95) para un conjunto de hasta 5.000 registros con la base de datos operativa y sin degradación de recursos.
2. THE API_Backend SHALL entregar los listados de forma paginada, limitando cada respuesta a un máximo de 50 registros por página de forma predeterminada y a un máximo de 200 registros por página cuando el cliente solicite un tamaño mayor.
3. WHEN un Usuario_Operador solicita una página fuera del rango de resultados disponibles, THE API_Backend SHALL devolver un listado vacío junto con el total de registros existentes.
4. WHEN un Usuario_Operador aplica un filtro o búsqueda sobre un listado, THE API_Backend SHALL resolver la consulta apoyándose en índices de base de datos sobre las columnas filtradas.
5. THE API_Backend SHALL construir los listados que combinan Activos, Colaboradores y Asignaciones sin ejecutar una consulta adicional por cada registro (evitando el patrón N+1).

### Requirement 10: Eficiencia de la carga del frontend

**User Story:** Como Usuario_Operador, quiero que la interfaz cargue rápido y responda de inmediato, para no perder tiempo entre vistas.

#### Acceptance Criteria

1. WHEN un Usuario_Operador cambia a una sección ya visitada cuyos datos no han sido invalidados, THE Interfaz_Web SHALL reutilizar los datos ya cargados en el store sin emitir una nueva solicitud a la API_Backend.
2. IF los datos de una sección han sido invalidados por una operación de escritura, THEN THE Interfaz_Web SHALL solicitar nuevamente los datos a la API_Backend antes de mostrarlos.
3. WHEN un Usuario_Operador escribe en un campo de búsqueda, THE Interfaz_Web SHALL esperar 300 ms sin nuevas pulsaciones (debounce) antes de emitir la solicitud a la API_Backend.
4. WHEN un Usuario_Operador realiza la carga inicial de la Interfaz_Web, THE Interfaz_Web SHALL cargar de forma diferida (lazy) los módulos de vistas que no corresponden a la vista inicial mostrada.

---

## Grupo E — Seguridad

### Requirement 11: Autenticación y autorización

**User Story:** Como responsable del Sistema_Inventario, quiero que solo usuarios autenticados y autorizados accedan a las operaciones, para proteger la información del inventario.

#### Acceptance Criteria

1. WHEN una solicitud a un endpoint protegido llega sin un token válido o sin token, THE API_Backend SHALL rechazarla con código 401 sin ejecutar la operación solicitada.
2. WHEN una solicitud a un endpoint protegido llega con un token cuya vigencia ha expirado, THE API_Backend SHALL rechazarla con código 401 sin ejecutar la operación solicitada.
3. WHERE una operación requiere rol admin o superadministrador, THE API_Backend SHALL rechazar con código 403 las solicitudes de un Usuario_Operador con rol insuficiente sin ejecutar la operación solicitada.
4. THE API_Backend SHALL emitir la cookie de sesión con los atributos httpOnly, secure, sameSite estricto y un tiempo de expiración máximo de 8 horas desde su emisión.
5. WHEN un Usuario_Operador cierra sesión, THE API_Backend SHALL invalidar la sesión en el servidor e instruir al cliente para eliminar la cookie de sesión, de modo que las solicitudes posteriores con esa cookie sean rechazadas con código 401.

### Requirement 12: Protección de entradas y datos sensibles

**User Story:** Como responsable del Sistema_Inventario, quiero que las entradas se validen y los datos sensibles se protejan, para reducir el riesgo de ataques y filtraciones.

#### Acceptance Criteria

1. WHEN la API_Backend recibe datos de entrada en cualquier endpoint de escritura, THE API_Backend SHALL validar los datos contra un esquema definido antes de ejecutar cualquier operación de persistencia.
2. THE API_Backend SHALL ejecutar todas las consultas a la base de datos utilizando sentencias parametrizadas.
3. IF una validación de entrada falla, THEN THE API_Backend SHALL responder con código 400 y un mensaje que indique el campo o regla incumplida sin exponer detalles internos de implementación ni trazas de error, y SHALL no persistir ningún cambio.
4. THE API_Backend SHALL excluir el campo de contraseña de toda respuesta que devuelva datos de un Usuario_Operador.
5. THE Sistema_Inventario SHALL no registrar en logs, bajo ninguna circunstancia, valores de contraseñas, tokens de sesión ni Tokens_Confirmacion.

---

## Grupo F — Calidad de código y mantenibilidad

### Requirement 13: Consistencia de código y validación automatizada

**User Story:** Como desarrollador que mantiene el Sistema_Inventario, quiero un estándar de código verificado automáticamente, para mantener el proyecto mantenible.

#### Acceptance Criteria

1. WHEN se ejecuta el linter sobre el backend o el frontend, THE Sistema_Inventario SHALL completar la verificación con cero errores de linting.
2. IF un endpoint de la API_Backend produce un error, THEN THE API_Backend SHALL responder con un formato de error que incluya un código de estado, un identificador de tipo de error y un mensaje descriptivo, idéntico en estructura en todos los endpoints.
3. WHEN se ejecuta la suite de pruebas del backend, THE Sistema_Inventario SHALL ejecutar las pruebas en una sola corrida (sin modo watch) y reportar el resultado de aprobación o fallo de cada prueba.
4. THE Sistema_Inventario SHALL contar con pruebas automatizadas que cubran los flujos de creación de Asignacion, cierre de Asignacion y confirmación de Firma_Digital, verificando tanto el caso exitoso como al menos un caso de error por flujo.

---

## Grupo G — Corrección de errores conocidos

### Requirement 14: Consistencia entre estado del Activo y sus Asignaciones

**User Story:** Como Usuario_Operador, quiero que el estado de un Activo refleje siempre su situación real de asignación, para evitar inconsistencias entre módulos.

#### Acceptance Criteria

1. WHILE un Activo tiene una Asignacion en estado activa, THE Sistema_Inventario SHALL mantener el estado del Activo en Asignado y su responsable igual al Colaborador de la Asignacion.
2. WHEN una Asignacion pasa a estado cerrada por devolución, THE Sistema_Inventario SHALL dejar el Activo sin responsable y con el estado físico registrado en la devolución dentro de la misma operación atómica.
3. IF se detecta un Activo en estado Asignado sin una Asignacion en estado activa, THEN THE Sistema_Inventario SHALL mostrar un indicador visible de inconsistencia en la Ficha_Activo junto a un texto que describa la discrepancia.
4. WHEN un Colaborador es desvinculado durante el cierre de una Asignacion, THE API_Backend SHALL marcar al Colaborador como inactivo dentro de la misma operación atómica.
5. IF cualquier paso de una operación de cierre de Asignacion falla, THEN THE API_Backend SHALL revertir todos los cambios de esa operación dejando el estado del Activo, la Asignacion y el Colaborador sin modificar.

---

## Grupo H — Experiencia de usuario (UX/UI)

### Requirement 15: Estados vacíos, errores y accesibilidad

**User Story:** Como Usuario_Operador, quiero una interfaz clara en todas sus situaciones, incluyendo estados vacíos y errores, para trabajar con confianza.

#### Acceptance Criteria

1. WHERE un listado no contiene registros, THE Interfaz_Web SHALL mostrar un estado vacío que explique la ausencia de datos y ofrezca la acción principal disponible para esa sección.
2. IF ocurre un error de red al cargar una vista, THEN THE Interfaz_Web SHALL mostrar un mensaje de error con un control visible que permita reintentar la carga de esa vista.
3. THE Interfaz_Web SHALL asociar una etiqueta accesible a cada control de formulario.
4. THE Interfaz_Web SHALL permitir completar los flujos de creación, asignación y devolución utilizando únicamente navegación por teclado, incluyendo el envío final de cada formulario.
5. WHEN el ancho de la ventana es igual o menor a 768 px, THE Interfaz_Web SHALL adaptar la disposición de listados y formularios de modo que todos los controles permanezcan visibles y operables sin desplazamiento horizontal.
