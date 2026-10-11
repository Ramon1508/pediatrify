# ASISTENTE

**Revisión vigente: 10 de octubre de 2026 (P46/D10).** Describe el comportamiento confirmado en código y pruebas locales. El conjunto de servicios ya fue publicado y habilitado en la ventana D10 autorizada; se verificaron configuración y rutas públicas. No se ejecutaron pruebas funcionales con cuentas reales ni SMTP por decisión D09. Consultar [condiciones compartidas](SHARED_OPERATIONS_CONTEXT.md#condiciones-de-disponibilidad-para-los-futuros-manuales). No es un manual final ni contiene capturas; la auditoría inicial es histórica.

Contexto funcional para redactar el futuro manual del Asistente de Lilcare. Investigación estática del repositorio local al 4 de octubre de 2026, referencia 76791ac. No es el manual final ni validación de producción; sin capturas ni datos reales. Complementa [contexto compartido](SHARED_OPERATIONS_CONTEXT.md). CONFIRMADO: verificable en código; APARENTE / REQUIERE VALIDACIÓN: información funcional inferida; NO DETERMINABLE DESDE EL CÓDIGO: necesita decisión o información externa.

Actualización funcional local del 8 de octubre de 2026: validación de Doctor asociado y aviso con Reintentar/Cerrar sesión. Ver sección 5.9; comportamiento comprobado mediante pruebas sintéticas, pendiente de validación visual tras despliegue.

## 1. Propósito del rol

**CONFIRMADO:** el Asistente opera el calendario del Doctor que lo invitó, crea reservas y da de alta pacientes básicos mientras agenda. Identificador interno assistant.

Puede crear, reagendar en desktop y mobile y cancelar citas, consultar nombres/motivo de las reservas y recibir avisos. **Puede configurar días, segmentos y duración de consulta. Permitir que los pacientes agenden citas corresponde exclusivamente al Doctor:** el Asistente no ve ese interruptor y sus cambios de horario no modifican ese permiso.

No tiene directorio editable de pacientes, perfil clínico, antecedentes, vacunas, gráficas, Datos por consulta, recetas o impresión. Puede conocer el motivo escrito para una reserva, lo que no equivale al motivo/diagnóstico clínico de la atención. No gestiona otros asistentes ni doctores.

Fuentes revisadas: [rutas](src/app/app.routes.ts), [calendario](src/app/pages/calendar/calendar.ts), [detalle por rol](src/app/shared/components/appointment-detail-card/appointment-detail-card.html).

**Actualización local P13:** el nuevo registro por invitación está preparado y deshabilitado hasta activar el servicio con la protección de acceso. Confirmado por código/pruebas; validar correo y disponibilidad del ambiente antes del manual oficial.

## 2. Inicio de sesión / acceso

### Invitación y primer acceso

1. Su Doctor abre Asistentes → Agregar asistente y captura nombre/correo.
2. Se crea una invitación para Asistente, sin selector de rol. Recibe correo o enlace compartido manualmente.
3. El enlace se valida antes de abrir «Bienvenido». Solo necesita Contraseña y Confirmar contraseña, no teléfono/cédulas/consultorio/logo profesionales. Dura siete días, se usa una vez y no permite escoger rol o Doctor. Si caducó, fue usado o el Doctor reenvió otro, solicita una nueva invitación; el reenvío conserva la misma cuenta pendiente.
4. Contraseña de al menos ocho caracteres con mayúscula, minúscula, número y símbolo; confirmación igual.
5. Finalizar completa el registro; vuelve a login con «Tu cuenta ha sido creada».
6. Correo/contraseña → Iniciar sesión → Calendario del doctor asociado.

Si ya inició sesión y su registro está incompleto, vuelve a completar perfil. No existe autorregistro ni elección libre del Doctor desde su menú. La asociación procede del profesional que lo invitó.

### Acceso habitual y recuperación

- Usa el login del personal, no Acceso paciente.
- Correo requerido/formato válido y contraseña requerida; ojo muestra/oculta. «Correo o contraseña incorrectos» si no coincide.
- Olvidé mi contraseña → correo → Recuperar contraseña → enlace → Nueva contraseña/Confirmar → Restablecer contraseña → login. Mensajes de envío, expiración/invalidación y éxito iguales al personal.
- Hay cierre por una hora de inactividad en lógica del personal; no aviso previo dedicado confirmado.
- Puede editar nombre y correo propios desde Perfil. El cambio de nombre está disponible localmente; el cambio de correo requiere activar el servicio preparado. Su Doctor también mantiene estos datos desde Asistentes.

**Mobile:** botones de login apilados, registro breve adaptable. **Estado de certeza:** CONFIRMADO; entrega real del correo y vigencia de enlaces REQUIEREN VALIDACIÓN.

Fuentes revisadas: [invitación por rol](src/app/pages/doctors/dialogs/invite-doctor-dialog/invite-doctor-dialog.ts), [registro](src/app/pages/setup-profile/setup-profile.ts), [login](src/app/pages/login/login.ts), [recuperación](src/app/pages/reset-password/reset-password.ts), [agenda asociada](src/app/pages/calendar/calendar.ts).

## 3. Pantalla inicial

Calendario del Doctor asociado. Encabezado con marca, campana y botón de cuenta. **Sin sidebar ni barra inferior principal**. No hay acceso a una página Pacientes mediante navegación normal.

- Selector de fecha; Hoy cuando la semana elegida no es la actual.
- Configuración y Agendar consulta visibles.
- Desktop/tablet: semana domingo–sábado con bloques de pacientes, franjas horarias y días/horas fuera de disponibilidad diferenciados.
- Mobile: tarjetas del día elegido con hora y paciente; pulsar muestra detalle.
- Detalle: nombre y motivo de reserva si hay, Reagendar y Cancelar. **Ver historial oculto para Asistente.** No campos clínicos de consulta.
- Empty state mobile «No tienes consultas agendadas para este día.», referido a la fecha seleccionada.

No hay selector visible para cambiar de Doctor; trabaja con la agenda asociada a su invitación.

Al comprobar esa asociación puede ver «Verificando el Doctor asociado…». Si no es válida, el calendario se sustituye por «No podemos abrir tu calendario», con Reintentar y Cerrar sesión; no se ofrecen Configuración ni Agendar consulta en ese estado. Un fallo de comprobación tiene su propio mensaje. Ver 5.9.

Fuentes revisadas: [calendario visible](src/app/pages/calendar/calendar.html), [layout](src/app/pages/doctor-layout/doctor-layout.ts), [detalle](src/app/shared/components/appointment-detail-card/appointment-detail-card.html).

## 4. Navegación principal

| Elemento visible | Destino / finalidad | Mobile |
|---|---|---|
| Marca del encabezado | Volver a Calendario | Misma finalidad |
| Fecha | Selector para consultar otro día/semana | Vista diaria |
| Hoy | Volver a periodo actual cuando está fuera de semana actual | Condición basada en semana, no siempre aparece para otro día de esta semana |
| Configuración | Duración, días y segmentos | Panel inferior |
| Agendar consulta | Reserva con búsqueda/alta básica de paciente | Panel inferior |
| Consulta | Detalle y acciones | Tarjeta expandible |
| Campana | Notificaciones | Página completa |
| Icono de cuenta | Perfil de lectura y Cerrar sesión | Página completa |

No hay botones principales Pacientes, Asistentes, Impresión, Doctores o Historial. Un menú ausente no debe reemplazarse en el manual por una URL para eludir la restricción; las rutas también excluyen Asistente de esas páginas.

Fuentes revisadas: [rutas](src/app/app.routes.ts), [encabezado](src/app/shared/components/header/header.ts), [calendario](src/app/pages/calendar/calendar.html).

## 5. Funciones disponibles

### 5.1 Consultar agenda del Doctor

**Objetivo:** revisar reservas y localizar a un paciente en una fecha.

**Cómo llegar:** entrada tras login → Calendario; marca del encabezado para volver.

**Pasos:**

1. Pulsa fecha.
2. Elige día.
3. Revisa semana desktop/día mobile.
4. Abre una consulta.
5. Revisa nombre/motivo y acciones.

**Campos:** fecha de navegación, lectura de nombre y motivo de reserva; horas en cuadrícula/tarjetas.

**Acciones:** elegir fecha consulta otros periodos; Hoy vuelve; cerrar detalle no modifica. No botones visibles de flechas semanales confirmados.

**Resultado esperado:** consulta de agenda vinculada al Doctor, no libre selección de cualquier agenda.

**Validaciones:** navegación al pasado permitida; reservas nuevas no. Ver historial está oculto y la ruta clínica no admite este rol.

**Mensajes / estados especiales:** días/horas grises; si no hay configuración disponible puede mostrarse «Selecciona días disponibles en Configuración para ver el calendario.» en cuadrícula desktop. Mobile tiene mensaje de sin consultas.

**Mobile:** tarjetas por día y detalle expandido; sin barra inferior principal.

**Dependencias con otros roles:** reservas y configuración del Doctor, otros asistentes o Paciente habilitado.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [agenda](src/app/pages/calendar/calendar.ts), [vista](src/app/pages/calendar/calendar.html), [restricción de detalle](src/app/shared/components/appointment-detail-card/appointment-detail-card.ts).

### 5.2 Buscar paciente y agendar consulta

**Objetivo:** reservar para un paciente que ya está registrado.

**Cómo llegar:** Calendario → Agendar consulta; desktop también celda disponible.

**Pasos:**

1. Abre formulario.
2. Escribe nombre/apellidos en Buscar paciente.
3. Selecciona un resultado.
4. Elige Día y Hora.
5. Añade motivo opcional.
6. Pulsa Agendar.

**Campos:**

| Campo | Requisito |
|---|---|
| Buscar paciente | Selección obligatoria de un resultado del Doctor asignado al Asistente; escritura sola no elige paciente |
| Día | Obligatorio, no pasado, día semanal abierto |
| Hora | Obligatoria, generada por segmentos y duración |
| Motivo de la consulta (opcional) | Texto máximo cien caracteres, contador |

**Acciones:** Agendar crea; X cierra sin guardar. + Añadir nuevo paciente permite alta básica dentro del mismo panel. No hay acceso desde Perfil del paciente, porque el Asistente no tiene esa pantalla.

**Resultado esperado:** «Cita agendada», cierre y reserva en agenda del Doctor; se crean avisos de consulta.

**Validaciones:** hoy solo horas posteriores a la hora actual del centro de México; fecha abierta y duración completa dentro de segmento. El reloj del consultorio determina hoy incluso si el dispositivo usa otra zona. Las opciones de un formulario abierto se actualizan al cambiar el minuto; guardar vuelve a validar día/hora. Si el día ya no tiene horarios, indica «Selecciona un día con horarios disponibles del consultorio.». Una hora ocupada **no se bloquea para personal**: advertencia de superposición. No hay un requisito de autorización manual posterior por Doctor.

Al agendar o reagendar, cambiar Día conserva Hora solo si pertenece a las opciones del nuevo día; si no, se limpia y exige seleccionar otra. Antes de guardar se recalculan las opciones, incluyendo las horas de hoy que ya pasaron durante la edición. Si la hora no es válida, muestra «Selecciona una hora disponible dentro del horario del doctor para el día elegido.» y no guarda. No modifica paciente ni motivo al limpiar Hora. CONFIRMADO en P21; fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.spec.ts`.

**Mensajes / estados especiales:** «Selecciona un paciente de los resultados de búsqueda.», «Selecciona un día», «Selecciona una hora»; «Ya existe una cita agendada en esta fecha y hora. La nueva cita se sobrepondrá a la existente.»; error de día no disponible o guardado.

**Selección de paciente:** editar o borrar el texto después de seleccionar retira la selección y exige elegir un resultado antes de Agendar. Escribir el mismo nombre tampoco lo selecciona. Enfocar/desplegar el buscador conserva la selección; un paciente creado en el formulario embebido se selecciona al volver. En Reagendar el paciente permanece fijo. CONFIRMADO en P24; fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, su template y sus pruebas.

**Mobile:** panel inferior con scroll, campos adaptables; creación conectada.

**Dependencias con otros roles:** usa disponibilidad del Doctor; la acción no necesita que el portal permita agendar. Paciente y Doctor pueden ver reserva posteriormente.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [entrada de reserva](src/app/pages/calendar/calendar.ts), [formulario](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [campos](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.html).

### 5.3 Añadir nuevo paciente mientras se agenda

**Objetivo:** crear un expediente básico cuando el niño todavía no aparece como opción de la reserva.

**Cómo llegar:** Agendar consulta → + Añadir nuevo paciente.

**Pasos:**

1. Abre alta dentro del panel.
2. Captura datos básicos/contacto.
3. Revisa sugerencias familiares y pulsa Añadir paciente.
4. Si aparece aviso de correo compartido, verifica la asociación familiar y pulsa Continuar.
5. Si aparece también nombre coincidente, verifica los datos y confirma ese segundo aviso con Continuar. Tras aceptar el último se guarda automáticamente.
6. Regresa automáticamente con niño seleccionado.
7. Completa Día/Hora y confirma Agendar.

**Campos:** nombre completo, nacimiento no futuro, correo principal válido, padre/tutor, madre/tutora y teléfono de exactamente diez dígitos obligatorios; secundario opcional válido.

**Acciones:** Añadir paciente crea expediente; flecha de regreso/X vuelve al formulario de reserva. No abre un segundo drawer. Crear no confirma la cita; todavía hace falta Agendar. Sugerencias de tutores pueden completar datos familiares vacíos.

**Resultado esperado:** paciente básico vinculado al Doctor de la agenda; acceso enviado a los correos principal y secundario guardados, sin duplicarlo si coinciden. El Asistente no ve ni recibe la contraseña, tampoco en alertas. Tras completar el alta regresa a la reserva con el niño seleccionado.

**Validaciones:** requeridos/correos/teléfono; aviso de duplicado con Continuar.

**Actualización local P23 — CONFIRMADO:** compartir correo permite crear hermanos, después de confirmar el aviso. Correo y nombre coincidente se aceptan por separado dentro del Doctor asociado. Cambiar nombre/correo principal/secundario invalida la confirmación y requiere comprobar nuevamente con Añadir paciente. Este botón está deshabilitado mientras queda un aviso pendiente; Continuar requiere un formulario válido. Guardar está deshabilitado con errores, sin cambios o durante la petición; pulsaciones repetidas durante el guardado no crean otra petición. Un error de guardado se muestra separado y no permite Continuar como si fuera una coincidencia. Fuentes: `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts`, `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.spec.ts`.

**Mensajes / estados especiales:** si el envío falla total o parcialmente, el expediente ya existe. La pantalla distingue el resultado por contacto y ofrece Reintentar envío y Continuar con el paciente. El Asistente puede reintentar solo el envío de esa alta original, a los destinatarios guardados, sin regenerar ni consultar la contraseña. Si cambió la credencial o ya no cumple las condiciones del alta, solicita intervención del Doctor. No volver a crear al niño por un fallo de correo. La contraseña es reutilizable; no describirla como de un solo uso.

**Mobile:** se sustituye contenido del mismo panel inferior; regreso conserva contexto de cita. Campos pueden envolver, no necesariamente única columna universal.

**Dependencias con otros roles:** Doctor deberá completar antecedentes/vacunas y puede editar/eliminar o regenerar contraseña después. Asistente no tiene acceso posterior a esas operaciones desde una lista de pacientes. Tutor usa el correo y contraseña creados.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [alta](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts), [campos](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.html), [regreso a cita](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts).

### 5.4 Reagendar o cambiar motivo de una reserva

**Objetivo:** corregir día/hora/motivo sin cambiar el niño.

**Cómo llegar:** Calendario → consulta → Reagendar.

**Pasos:**

1. Abre detalle.
2. Pulsa Reagendar.
3. Modifica Día/Hora o motivo.
4. Pulsa Reagendar del formulario.

**Campos:** paciente fijo, no sustituible; Día/Hora requeridos; motivo opcional hasta cien caracteres; información previa precargada.

**Acciones:** Reagendar actualiza; X conserva cita si no se guarda. No acceso a su registro clínico.

**Resultado esperado:** «Cita actualizada»; si fecha/hora cambian se generan avisos de reagenda. Solo motivo no genera ese aviso.

El Asistente puede conservar fecha/hora y corregir solo el motivo. El Paciente también puede conservarlas desde su portal: su propia cita no cuenta como ocupación, pero otra reserva vigente a esa hora sí lo bloquea. El Asistente mantiene la advertencia de superposición del personal, sin bloqueo obligatorio. CONFIRMADO en P20; fuentes: `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/calendar.spec.ts`.

**Validaciones:** conservar exactamente fecha/hora original permite corregir motivo aunque la disponibilidad cambie, el día cierre o la cita sea pasada. Cambiar fecha/hora exige disponibilidad actual. Superposición con advertencia para personal; no permite reactivar canceladas/deshabilitadas.

**Mensajes / estados especiales:** requeridos, día no disponible y errores de guardado dentro del formulario.

**Mobile:** selecciona el día, pulsa la tarjeta de consulta y después Reagendar. Se cierra el detalle y aparece el mismo formulario en un panel inferior, con paciente fijo y datos precargados. Guardar actualiza la reserva; X conserva los datos anteriores. Mantiene las validaciones de desktop y requiere una agenda de Doctor asociada válida.

**Dependencias con otros roles:** cambia agenda compartida y avisos de Doctor/familia. No requiere activar permiso del portal Paciente.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [detalle](src/app/shared/components/appointment-detail-card/appointment-detail-card.ts), [eventos de vista](src/app/pages/calendar/calendar.html), [edición](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts).

### 5.5 Cancelar consulta

**Objetivo:** retirar una reserva del calendario habitual.

**Cómo llegar:** Calendario → consulta → Cancelar.

**Pasos:**

1. Pulsa Cancelar.
2. Lee aviso al padre/tutor.
3. Pulsa Cancelar consulta para aceptar, o Cerrar para mantenerla.

**Campos:** no pide motivo o nueva fecha.

**Acciones:** confirmar cancela; Cerrar conserva. No borra paciente ni registros clínicos ni agenda automáticamente sustitución.

**Resultado esperado:** «Cita cancelada», reserva retirada y aviso a participantes.

El horario cancelado deja de contar como ocupado y puede reservarse de nuevo si no hay otra cita vigente a la misma hora y el horario del Doctor lo permite. Una cancelada no genera advertencia de superposición. No se crea automáticamente una nueva reserva. Actualización local P19 del 9 de octubre de 2026. Fuentes: `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`.

**Validaciones:** confirmación, sin regla de anticipación o penalización encontrada. No depende del interruptor que restringe al Paciente.

**Mensajes / estados especiales:** explicación de que el tutor recibe aviso y puede seleccionar otro día/hora; esa acción del tutor depende de habilitación. Fallos de notificación no revierten la cancelación;

**Mobile:** cancelar sí conectado; confirmación modal adaptable.

**Dependencias con otros roles:** Doctor/tutor afectados; Asistente no elimina expedientes por esta acción.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [cancelar](src/app/pages/calendar/calendar.ts), [botones](src/app/shared/components/appointment-detail-card/appointment-detail-card.html).

### 5.6 Configurar horarios

**Objetivo:** ajustar duración y disponibilidad semanal del Doctor asociado.

**Cómo llegar:** Calendario → Configuración.

**Pasos:**

1. Selecciona duración.
2. Selecciona un día.
3. Añade/edita/elimina sus segmentos Inicio–Fin.
4. Repite días.
5. Pulsa Guardar configuración.

**Campos:** duración 10/15/30/45/60/120 minutos; días Lun a Dom; segmentos con Inicio/Fin como hora. Fin 00:00 representa final del día. No aparece Permitir que los pacientes agenden citas.

**Acciones:** chip selecciona día, check indica segmentos existentes; añadir inserta 06:00–00:00; quitar modifica borrador sin confirmar; Guardar aplica; Cancelar/X descarta. No hay plantillas mensuales o festivos por fecha.

**Resultado esperado:** «Configuración guardada», opciones de agenda ajustadas al doctor asociado. Se conserva el permiso de reserva del Paciente elegido por el Doctor. No cancela reservas existentes que ahora estén fuera del horario.

**Cerrar toda la semana:** puedes eliminar todos los segmentos de los siete días y guardar. La configuración reabierta mantiene todos los días cerrados; no ofrece fechas/horas para nuevas reservas. Añadir un segmento y guardar vuelve a habilitar ese día. Se conservan las citas existentes y la elección del Doctor sobre permitir reservas a pacientes. CONFIRMADO en el código y autorizado en P25; fuentes: `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`, `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/p25-closed-week.spec.ts`.

**Validaciones:** duración requerida y positiva. Cada segmento exige Inicio/Fin válidos en HH:mm de 24 horas; Fin debe ser posterior, con 00:00 como final del día. Se permiten segmentos consecutivos y huecos, pero no solapamientos ni duplicados del mismo día. Horas iguales en días diferentes no chocan. 22:00–00:00 es válido; 00:00–00:00 representa el día completo. Los valores no se reordenan/corrigen automáticamente.

«Corrige los horarios indicados antes de guardar.» lista día, número de segmento e instrucción de corrección para todos los días, incluido uno que no esté seleccionado. Cambia a ese día y corrige o elimina el segmento. Guardar se bloquea por errores, falta de cambios o petición en curso. Recorrer los días no modifica el formulario; cerrar toda la semana sí sigue permitido. Se aplican las mismas validaciones que al Doctor, conservando su permiso de reservas del Paciente. CONFIRMADO en P26; fuentes: `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`, su template y sus pruebas.

**Mensajes / estados especiales:** «Error al guardar configuración». Una cuenta sin configuración puede utilizar valores por defecto lunes–sábado, 06:00–00:00, treinta minutos. Una semana cerrada guardada desde Configuración se conserva cerrada al volver a abrirla.

**Mobile:** panel inferior; chips envuelven y horas pueden permanecer en fila. No toda edición móvil es una sola columna.

**Dependencias con otros roles:** afecta Doctor y tutores. El Doctor decide si los pacientes pueden agendar; el Asistente únicamente ajusta la disponibilidad y la duración.

**Estado de certeza:** CONFIRMADO en controles, guardado y aplicación del horario del doctor asociado.

Fuentes revisadas: [abrir ajustes](src/app/pages/calendar/calendar.ts), [horarios](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts), [campos](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.html).

### 5.7 Revisar notificaciones y marcar lectura

**Objetivo:** conocer altas/cambios/cancelaciones de la agenda que opera.

**Cómo llegar:** campana del encabezado.

**Pasos:**

1. Abre campana.
2. Elige Todos/Sin leer.
3. Desplázate para cargar más.
4. Ver detalles abre la cita, o Marcar todas como leídas limpia pendientes.

**Campos:** título, descripción con niño/día/hora, marca de lectura y contador global para su destinatario.

**Acciones:** abrir/filtrar/scroll no marca todos. Ver detalles marca solo ese aviso y enfoca Calendario. Lectura masiva sin confirmación; cerrar/abandonar marca cancelaciones como leídas.

**Resultado esperado:** contador y filtros actualizados; detalle no abre historial clínico. Puede recibir avisos de operaciones que él mismo realizó.

**Validaciones:** citas canceladas sin detalles; enlace puede desaparecer cuando se confirma cita inexistente/deshabilitada. No borrar aviso individual.

**Mensajes / estados especiales:** «Aún no tienes notificaciones.», «No tienes notificaciones sin leer.», «Has llegado al final de tus notificaciones.»; error de lectura masiva solicita reintento.

**Mobile:** página completa; control del encabezado permite volver. Desktop ventana superior derecha con scroll en lista y filtros fijos.

**Dependencias con otros roles:** Doctor, asistentes del mismo consultorio y familia reciben avisos de agenda; Admin excluido. No se comprobó push, recordatorio previo ni correo garantizado por cada aviso.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [campana](src/app/shared/components/notification-bell/notification-bell.ts), [lista/acciones](src/app/shared/components/notifications-dialog/notifications-dialog.ts), [destinatarios](src/app/core/services/notification.service.ts).

### 5.8 Consultar y editar perfil propio; cerrar sesión

**Objetivo:** consultar identidad, corregir nombre/correo y terminar acceso.

**Cómo llegar:** cuenta del encabezado → Perfil → Editar perfil.

**Pasos:** 1. Revisa nombre/correo. 2. Pulsa Editar perfil. 3. Cambia Nombre completo y/o Correo electrónico. 4. Guarda o cancela. 5. Si cambia correo, vuelve a iniciar sesión con nuevo correo y contraseña actual tras confirmar.

**Campos:** Nombre completo obligatorio, no solo espacios, hasta 300 caracteres; correo obligatorio, válido, hasta 254 caracteres. Sin Doctor asociado, logo o datos profesionales editables.

**Acciones:** Editar perfil habilita nombre/correo. Guardar cambios aplica solo campos permitidos; Cancelar descarta; Cerrar sesión termina acceso.

**Resultado esperado:** nombre solo actualiza perfil y mantiene sesión, con «Cambios guardados.» en desktop. Correo conserva cuenta, contraseña y Doctor asociado, cierra sesión y vuelve al login. Se guardan nombre y correo juntos cuando cambia este último.

**Validaciones:** Guardar deshabilitado por inválido/intacto/sin cambios/carga. «Ingresa tu nombre completo.»; «Ingresa un nombre de hasta 300 caracteres.»; «Ingresa un correo electrónico válido de hasta 254 caracteres.». Correo utilizado por otra cuenta rechazado.

**Mensajes / estados especiales:** spinner y cierre bloqueado durante petición; errores conservan borrador. Para correo confirmado: «Correo actualizado. Inicia sesión con tu nuevo correo y tu contraseña actual.». Un guardado interrumpido puede requerir login con nuevo correo y reintento con los mismos datos.

**Mobile:** página de lectura; Editar abre panel inferior. Nombre guardado cierra el panel y refresca perfil; correo confirmado vuelve al login.

**Dependencias con otros roles:** Doctor puede corregir nombre/correo del Asistente y gestiona su baja. Edición propia no cambia asociación ni permisos sobre agenda. Baja del Doctor tiene cascada preparada con activación pendiente.

**Estado de certeza:** CONFIRMADO localmente. Nombre solo usa el guardado existente; correo conectado pero deshabilitado hasta activación y prueba integrada. No enseñar correo como disponible en producción todavía.

Fuentes revisadas: `src/app/shared/components/profile-dialog/profile-dialog.ts`, `.html`, `src/app/core/services/staff-email-change.service.ts`, `functions/src/staff-email-change.ts`.\n\n### 5.9 Reintentar el acceso a una agenda no disponible

**Objetivo:** comprobar de nuevo la asociación o salir de la cuenta cuando no puede abrirse su agenda.

**Cómo llegar:** entrar a Calendario y recibir el aviso «No podemos abrir tu calendario».

**Pasos:**

1. Leer el mensaje: asociación inválida o fallo al verificarla.
2. Pulsar Reintentar para volver a comprobar su perfil y el Doctor asociado.
3. Si la asociación sigue sin ser válida, contactar al responsable del consultorio. La pantalla no permite elegir ni reasignar Doctor.
4. Alternativamente, pulsar Cerrar sesión para volver al login del personal.

**Campos:** ninguno; no se solicita un identificador de Doctor ni información clínica.

**Acciones:** Reintentar comprueba nuevamente, sin modificar perfiles; Cerrar sesión sale de la cuenta y vuelve al login cuando termina correctamente.

**Resultado esperado:** calendario habitual si la asociación es válida; aviso si continúa inválida o falla la lectura. Una corrección externa de la asociación puede reconocerse al reintentar.

**Validaciones:** debe existir un Doctor asociado, con registro completo y sin invitación pendiente. No puede operar como agenda propia del Asistente ni usar una asociación que corresponda a otro rol. Durante la comprobación no se muestran acciones de la agenda.

**Mensajes / estados especiales:** «Verificando el Doctor asociado…»; «Tu cuenta no tiene un Doctor válido asociado. Contacta al responsable del consultorio.»; «No fue posible verificar el Doctor asociado. Reintenta o contacta al responsable del consultorio.»; «No fue posible cerrar sesión. Intenta nuevamente.». Si el Doctor deja de estar disponible mientras utiliza el calendario, se retiran los datos y se cierran los paneles de esa agenda; no se confirma automáticamente una cancelación pendiente.

**Mobile:** mismo aviso y acciones; botones de ancho completo hasta 768 px. No se muestra simultáneamente la lista móvil de consultas.

**Dependencias con otros roles:** la asociación no la modifica el Asistente. El canal y responsable organizativo de corregirla no están definidos por esta pantalla.

**Estado de certeza:** CONFIRMADO en código local y pruebas sintéticas; presentación final tras despliegue REQUIERE VALIDACIÓN.

Fuentes revisadas: [calendario](src/app/pages/calendar/calendar.ts), [aviso](src/app/pages/calendar/calendar.html), [pruebas funcionales simuladas](src/app/pages/calendar/calendar-association.spec.ts).

## 6. Flujos completos

| Flujo | Secuencia |
|---|---|
| Incorporación | Doctor invita → enlace → Bienvenido/contraseñas → Finalizar → login → calendario asociado |
| Reservar existente | Calendario → Agendar → buscar/seleccionar niño → Día/Hora → motivo → Agendar |
| Reservar niño nuevo | Agendar → Añadir nuevo paciente → datos básicos → guardar niño → regreso con selección → Día/Hora → Agendar |
| Reagendar desktop/mobile | Consulta → Reagendar → niño fijo → día/hora/motivo → guardar → avisos |
| Cancelar | Consulta → Cancelar → aviso/confirmación → Cancelar consulta → reserva retirada |
| Ajustar disponibilidad | Configuración → duración → días/segmentos → guardar → calendario ajustado |
| Aviso recibido | Campana → Todos/Sin leer → Ver detalles → Calendario enfocado, sin historial clínico |
| Salir/recuperar | Perfil → Cerrar sesión; o login → Olvidé mi contraseña → enlace/nueva contraseña → login |

Tras crear paciente no hay Completar perfil o Añadir entrada accesibles al Asistente; el Doctor debe continuar el proceso clínico. No registrar «consulta atendida» ni «paciente visto» como un paso confirmado de estas reservas.

## 7. Responsive / mobile

| Área | Desktop | Tablet | Mobile hasta 768 px |
|---|---|---|---|
| Navegación | Sin sidebar | Sin sidebar | Sin barra inferior principal |
| Calendario | Semana/horas | Cuadrícula con menos espacio | Día/tarjetas y detalle expandido |
| Configuración y Agendar | Botones en toolbar | Pueden envolver | Dos botones en fila adaptable |
| Reserva/alta embebida | Panel derecho | Panel adaptable | Panel inferior, mismo contenedor al cambiar de subpaso |
| Reagendar | Formulario con paciente fijo | Formulario adaptable | Tarjeta → detalle → Reagendar → panel inferior precargado |
| Cancelar | Modal | Modal | Modal conectado y adaptable |
| Horarios | Días/segmentos en panel | Mismos controles | Chips envueltos, scroll, horas según espacio |
| Notificaciones | Ventana superior derecha | Adaptable | Página completa |
| Perfil | Modal | Modal | Página completa de lectura |

Tablet general 769–1024 px, sin experiencia separada universal. No hay versión móvil de historial/vacunas para Asistente porque carece del acceso, no porque el móvil los oculte.

Fuentes revisadas: [estilos comunes](src/styles.scss), [calendario](src/app/pages/calendar/calendar.scss), [header](src/app/shared/components/header/header.ts), estilos de reserva/configuración.

## 8. Empty states

| Lugar | Mensaje / estado | Acción |
|---|---|---|
| Doctor asociado no válido | «No podemos abrir tu calendario» y explicación | Reintentar / Cerrar sesión; no Agendar ni Configuración |
| Agenda mobile sin citas | «No tienes consultas agendadas para este día.» | Agendar consulta o elegir otra fecha |
| Agenda desktop sin días | «Selecciona días disponibles en Configuración para ver el calendario.» | Configuración; puede no verse en mobile porque pertenece a cuadrícula oculta |
| Selector sin paciente coincidente | Opciones vacías, sin texto específico confirmado | Cambiar búsqueda o Añadir nuevo paciente |
| Notificaciones Todos | «Aún no tienes notificaciones.» | Cerrar/cambiar filtro |
| Sin leer | «No tienes notificaciones sin leer.» | Todos |
| Fin de avisos | «Has llegado al final de tus notificaciones.» | No hay más scroll que cargue registros |
| Perfil sin datos | Campos de lectura según registro | Sin edición propia |

No inventar empty states de Pacientes, vacunas, asistentes o datos clínicos para este rol: no tiene esas páginas.

## 9. Confirmaciones y acciones destructivas

- Cancelar consulta: confirmación «Cancelar consulta», aviso al tutor; confirmar cancela; Cerrar conserva.
- No acción normal Eliminar paciente/Doctor/Asistente, borrar consulta clínica o eliminar cita definitivamente.
- Alta/reserva: X o flecha vuelve/cierra sin confirmación universal de cambios; volver no elimina un paciente ya creado.
- Eliminar segmento: sin confirmación, borrador; Guardar lo aplica y Cancelar descarta.
- Cerrar configuración: no guarda; reservas existentes permanecen.
- Leer todas las notificaciones: directo; cerrar lista marca cancelaciones.
- Cerrar sesión: directo; no una eliminación de cuenta.

## 10. Estados read-only y editables

- Detalle de cita: nombre/motivo lectura; Reagendar permite editar datos de reserva, no clínicos.
- Nueva reserva: selección de paciente; edición de reserva: paciente fijo.
- Alta básica: datos editables antes de crear; después no hay perfil editable accesible al Asistente.
- Horarios: borrador editable por día; cada día tiene sus segmentos; lectura posterior toma lo guardado. El permiso para que los pacientes agenden no se muestra ni se incluye en el guardado del Asistente.
- Perfil propio: lectura inicial y edición de nombre/correo; sin logo, contraseña ni Doctor asociado editable. Cambio de correo pendiente de activar servicio.
- Asociación no válida: agenda y formularios de citas/horarios no disponibles; solo Reintentar y Cerrar sesión en el aviso.
- Fecha de navegación puede ser antigua; fecha de nueva reserva no. No campos de medidas/diagnósticos.
- El permiso de reservas del Paciente no deshabilita al Asistente: no confundir usuarios internos y portal.

## 11. Validaciones

| Contexto | Reglas / mensajes |
|---|---|
| Acceso a agenda | Doctor asociado existente, rol Doctor, registro completo y sin invitación pendiente; si no, aviso de sección 5.9 |
| Registro/recuperación | Contraseña fuerte mínimo ocho, confirmación; «Las contraseñas no coinciden» |
| Login | Correo/contraseña requeridos; «Correo o contraseña incorrectos» |
| Reserva | Selección real de paciente, día/hora; hoy futuro, días abiertos, consulta cabe en segmento; motivo cien caracteres |
| Superposición | Aviso, no bloqueo de hora ocupada al personal |
| Alta niño | Nombre/nacimiento no futuro/correo/ambos tutores/teléfono de diez dígitos; secundario válido si existe |
| Duplicado | Aviso de coincidencia de datos |
| Horarios | Duración requerida; segmentos por día |
| Cancelación | Confirmación; sin motivo/anticipación obligatorios encontrados |
| Perfil propio | No edición accesible; ninguna validación de cambio propia |

No enseñar que todos los botones se deshabilitan si el formulario está intacto/inválido: varios dejan intentar y entonces muestran errores; bloqueo durante carga sí existe en operaciones de guardar.

## 12. Estados de carga y error

La comprobación de la asociación muestra «Verificando el Doctor asociado…». Un fallo muestra «No fue posible verificar el Doctor asociado. Reintenta o contacta al responsable del consultorio.», con Reintentar y Cerrar sesión. Ver 5.9.

- Login, registro y recuperación: spinner/botón bloqueado y alertas/campos inválidos.
- Agenda: carga de configuración/skeleton en zona desktop. No una lista de error dedicada para todo fallo de lectura.
- Reserva: guardando con spinner, errores de disponibilidad y guardado dentro del formulario.
- Alta: campos con errores, indicador de proceso; fallo de correo posterior no elimina el paciente creado. No reintento de envío autónomo desde menú propio del Asistente.
- Configuración: guardado bloqueado y «Configuración guardada» / «Error al guardar configuración».
- Cancelar: éxito «Cita cancelada».
- Notificaciones: skeleton inicial, carga por scroll, spinner adicional y fallo de lectura masiva con «Intenta de nuevo».
- No centro de soporte, bitácora, trabajo offline, cola de pendientes ni botón general para resolver conflictos de datos.

## 13. Notificaciones

Disponible para Asistente; avisos de consulta agendada, cancelada y reagendada del Doctor asociado. Puede recibir también avisos de sus propias operaciones. Contador por destinatario; abrir/filtrar/scroll no marca todos. Ver detalles marca individual y lleva al Calendario enfocado; no muestra historial. Acción masiva marca todas; abandonar marca cancelaciones como leídas.

Desktop ventana, mobile página completa. Cancelaciones no tienen detalles; enlace de citas inexistentes/deshabilitadas se oculta al comprobarse. No hay push o recordatorios automáticos confirmados. Ver 5.7.

## 14. Perfil

Perfil muestra nombre y correo bajo etiqueta Asistente; Editar perfil permite corregir ambos. Nombre solo mantiene sesión; cambiar correo conserva la cuenta/contraseña y vuelve al login (requiere activar servicio preparado). Sin logo, datos profesionales, Doctor asociado o contraseña editable; recuperación desde login.

Desktop modal; móvil página completa. No se muestra un selector del Doctor asignado ni una herramienta para trasladarse de consultorio.

## Función | Doctor | Asistente

| Función | Doctor | Asistente |
|---|---|---|
| Consultar calendario | Sí, agenda propia | Sí, doctor asociado |
| Cambiar a otro Doctor desde selector visible | No | No |
| Agendar cita para paciente existente | Sí | Sí |
| Alta básica mientras agenda | Sí | Sí |
| Alta desde página Pacientes | Sí | No; solo alta embebida |
| Buscar pacientes | Sí, directorio y selector | Limitado: selector de cita |
| Reagendar | Sí: desktop/mobile | Sí: desktop/mobile, en la agenda de su Doctor asociado |
| Cancelar cita | Sí | Sí |
| Configurar días/segmentos/duración | Sí | Sí, del doctor asociado |
| Permitir reservas de pacientes | Sí | No; opción oculta y excluida de su guardado |
| Agendar desde historial con niño fijo | Sí | No |
| Ver listado/perfil completo de pacientes | Sí | No |
| Editar/eliminar pacientes | Sí | No |
| Regenerar contraseña del Paciente | Sí | No |
| Consultar/copiar contraseña del Paciente | Sí, expediente propio | No, tampoco en el alta |
| Reintentar correo de acceso de alta | Sí, propia operación | Limitado: solo su alta original, sin ver contraseña |
| Ver motivo de reserva | Sí | Sí; no equivale a diagnóstico clínico |
| Ver historial clínico / diagnósticos | Sí | No |
| Añadir/editar Datos por consulta | Sí | No |
| Consultar gráficas | Sí | No |
| Consultar/editar vacunas | Sí | No |
| Ver/imprimir receta y recomendaciones | Sí | No |
| Configurar impresión y logo | Sí | No |
| Gestionar asistentes | Sí, los propios | No |
| Consultar/gestionar notificaciones | Sí | Sí, sin historial clínico |
| Ver perfil propio y salir | Sí | Sí |
| Editar perfil propio | Sí, datos profesionales y correo fijo | Sí, nombre/correo (correo requiere activación del servicio) |
| Recuperar contraseña desde login | Sí | Sí |

La tabla compara los procedimientos disponibles en la navegación normal de cada rol.

## SCREENSHOTS RECOMENDADOS PARA EL MANUAL

- [ ] Alta con entrega parcial y reintento original, sin contraseña en ninguna alerta; desktop/mobile.
- [ ] Configuración semanal editable sin opción de permitir reservas del Paciente; desktop/mobile.
- [ ] Perfil con nombre/correo editables y retorno al login tras cambiar correo.
- [ ] Reagenda conservando día/hora original fuera de disponibilidad actual.

- [ ] Agendar: paciente seleccionado, edición del texto, mensaje de seleccionar resultado y botón bloqueado; desktop/mobile.

- [ ] Invitación caducada/usada/inválida y botón Ir a iniciar sesión: desktop/mobile, sin enlaces vigentes.
- [ ] Bienvenido con identidad de lectura y validación de contraseñas distintas: desktop/mobile.

- [ ] Correo/enlace de invitación ficticio y Bienvenido solo con contraseñas.
- [ ] Login del personal y recuperación, sin valores de contraseña.
- [ ] Calendario con encabezado sin sidebar; desktop/mobile.
- [ ] Comprobación del Doctor asociado, aviso de agenda no disponible y fallo de comprobación; desktop/mobile.
- [ ] Selector de fecha, Hoy y días fuera de disponibilidad.
- [ ] Detalle con Reagendar/Cancelar y ausencia de Ver historial; desktop/mobile.
- [ ] Agendar con búsqueda/autocompletado y paciente seleccionado.
- [ ] Advertencia de superposición del personal.
- [ ] Alta embebida con flecha, campos y retorno a cita; desktop/mobile.
- [ ] Validación de requeridos y aviso de duplicado, con datos ficticios.
- [ ] Confirmación de correo compartido y luego de nombre coincidente en el mismo panel; desktop/mobile. Error de guardado separado sin Continuar.
- [ ] Reagendar con paciente fijo: panel desktop y panel inferior mobile, con datos precargados.
- [ ] Confirmación Cancelar consulta.
- [ ] Configuración con duración y dos segmentos por día, sin interruptor de reservas del Paciente; desktop/mobile.
- [ ] Configuración reabierta con los siete días cerrados, sin segmentos ni interruptor de reservas del Paciente; desktop/mobile.
- [ ] Configuración con errores de campo, orden y solapamiento; aviso del día no seleccionado y corrección. Desktop/mobile.
- [ ] Empty state de agenda y sin notificaciones.
- [ ] Notificaciones Todos/Sin leer, contador y Ver detalles → agenda; desktop/mobile.
- [ ] Perfil de lectura Asistente y Cerrar sesión: modal desktop/página mobile.\n- [ ] Editar nombre/correo, errores de validación y aviso de nuevo login: desktop/panel inferior mobile.\n- [ ] Cambio de correo confirmado y error de duplicado (tras activar servicio; datos ficticios).

## INFORMACIÓN QUE NO PUDE CONFIRMAR DESDE EL CÓDIGO

1. ¿Qué responsabilidad tiene el Doctor al completar y validar el expediente creado por el Asistente?
2. ¿A quién comunica el Asistente un fallo de envío de acceso al paciente?
3. ¿Qué procedimientos organizativos debe seguir antes de cambiar la disponibilidad?
4. ¿Qué canal usa para informar al consultorio de una cancelación?
5. ¿Qué responsable y canal atienden al Asistente cuando su Doctor asociado no está disponible? La pantalla no ofrece reasignación.
6. ¿Qué responsable define las tareas diarias de agenda que deben explicarse en el manual?
