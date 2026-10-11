# PACIENTE

**Revisión vigente: 10 de octubre de 2026 (P46/D10).** Describe el comportamiento confirmado en código y pruebas locales. El conjunto de servicios ya fue publicado y habilitado en la ventana D10 autorizada; se verificaron configuración y rutas públicas. No se ejecutaron pruebas funcionales con cuentas reales ni SMTP por decisión D09. Consultar [condiciones compartidas](SHARED_OPERATIONS_CONTEXT.md#condiciones-de-disponibilidad-para-los-futuros-manuales). No es un manual final ni contiene capturas; la auditoría inicial es histórica.

Contexto funcional para el futuro manual del portal Paciente de Lilcare. Auditoría estática local al 4 de octubre de 2026, referencia 76791ac. No es el manual final ni una sesión probada en producción; sin screenshots ni datos personales. Ver [contexto compartido](SHARED_OPERATIONS_CONTEXT.md). Las funciones confirmadas en código se distinguen de información funcional APARENTE / REQUIERE VALIDACIÓN y políticas NO DETERMINABLES DESDE EL CÓDIGO.

## 1. Propósito del rol

**CONFIRMADO:** el usuario del portal consulta las citas y documentos vigentes de niños asociados a su correo. Habitualmente actúa el padre/madre/tutor, aunque la sesión se identifica con un expediente infantil. No existe una cuenta autónoma de padre o madre con un perfil separado.

Puede agendar, reagendar en desktop y mobile y cancelar sus reservas si el Doctor habilita esas operaciones. El resultado de Agendar es una cita registrada directamente; no una solicitud pendiente de aprobación.

No crea/edita/elimina pacientes, no registra atención, no consulta diagnósticos/antecedentes/gráficas/vacunas del historial del Doctor y no configura horarios o impresión profesional.

Fuentes revisadas: [sesión de acceso](src/app/core/services/auth.service.ts), [rutas del portal](src/app/app.routes.ts), [historial visible](src/app/pages/patient-history-view/patient-history-view.html).

## 2. Inicio de sesión / acceso

### Cómo obtiene acceso

1. El Doctor, o su Asistente desde una reserva, da de alta al niño y sus correos de contacto.
2. El sistema genera una contraseña y trata de enviar el acceso a los correos principal y secundario guardados, sin duplicar si coinciden. El Asistente no conoce esa contraseña.
3. El tutor entra por **Acceso paciente**, distinto del login del personal. La dirección de esta entrada es /patient-login; la raíz del sitio conduce al login de personal, no a este portal.
4. Introduce correo principal o secundario registrado y contraseña proporcionada por el consultorio; pulsa Entrar.
5. La pantalla inicial es Calendario.

No hay autorregistro, configuración inicial del tutor, verificación adicional de teléfono ni pantalla para elegir una contraseña propia. Un perfil infantil incompleto no obliga al tutor a completar antecedentes: esa labor corresponde al Doctor.

| Campo de acceso | Regla |
|---|---|
| Correo electrónico | Obligatorio y formato válido; espacios exteriores y mayúsculas no cambian la búsqueda normalizada |
| Contraseña | Obligatoria; corresponde a alguno de los expedientes asociados al correo. Ojo muestra/oculta |

Hint exacto: «Usa la contraseña que te proporcionó tu doctor.». Errores: «Ingresa un correo electrónico válido», «Ingresa tu contraseña de acceso», «Credenciales inválidas. Verifica tu correo y contraseña.» o error de verificación.

### Familia y recuperación

- Con el correo usado para entrar se obtiene el grupo de hijos que comparten ese correo principal/secundario con el **mismo Doctor** del expediente utilizado para autenticar. No hay un selector de doctores confirmado.
- Cada expediente tiene su propia contraseña; entrar con la de un niño puede mostrar los hermanos asociados al mismo grupo. No afirmar una contraseña única para toda familia.
- La contraseña se reutiliza y no caduca por tiempo ni se consume al entrar. Permanece válida hasta que el Doctor la renueva; tras la renovación se utiliza la nueva contraseña y se invalidan las sesiones ligadas a la anterior. Solo el sistema genera contraseñas, de seis caracteres y únicas entre accesos activos. «OTP» es solo una denominación interna del código.
- No hay Olvidé mi contraseña dentro de Acceso paciente ni cambio autónomo. El Doctor dispone de Ver contraseña/Copiar y Regenerar contraseña; la renovación trata de enviar el acceso a ambos contactos guardados.
- Si falló el correo durante alta, el niño ya existe. Recuperar la entrega no exige volver a crear el expediente.
- La sesión se mantiene únicamente mientras esta aplicación permanece abierta en la pestaña: no se guarda en cookies ni almacenamiento del navegador. Recargar o cerrar la pestaña requiere ingresar otra vez. Volver a una pestaña abierta conserva el tiempo restante. Una hora sin interacción cierra el acceso y vuelve a Acceso paciente; clics, teclado, puntero, interacción táctil y desplazamiento renuevan el plazo. Leer o recibir actualizaciones no lo renueva. Puede volver a entrar con la misma contraseña vigente.

**Mobile:** formulario adaptable y botón Entrar a ancho disponible. **Estado de certeza:** CONFIRMADO en acceso/agrupación; entrega de correo, identidad autorizada de tutor y canal de recuperación deben validarse con el consultorio.

Fuentes revisadas: [login paciente](src/app/pages/patient-login/patient-login.ts), [pantalla de acceso](src/app/pages/patient-login/patient-login.html), [familia](src/app/core/repositories/patient.repository.ts), [regeneración del Doctor](src/app/pages/patients/patients.ts).

## 3. Pantalla inicial

Calendario con encabezado Lilcare, selector de fecha, sus consultas familiares y navegación Calendario/Pacientes.

- Desktop: semana domingo–sábado con horarios; ve nombres de sus hijos y sus reservas. Las horas de otros pacientes se consideran ocupadas sin mostrar sus nombres como tarjetas propias.
- Mobile: día seleccionado y tarjetas hora | nombre del niño; tocar tarjeta despliega detalle.
- Agendar consulta aparece **solo** si el Doctor permite reservas del Paciente. Configuración no aparece.
- Detalle propio: nombre y motivo si hay; Ver historial. Reagendar/Cancelar solo cuando está habilitado agendar.
- Hoy aparece si se navega fuera de la semana actual; selector permite revisar otras fechas, incluidas anteriores.
- Sin consultas: «No tienes consultas agendadas para este día.» en móvil, referido al día seleccionado.

No se encontró un home distinto con resumen del Doctor, datos profesionales completos, saldo, pagos o lista separada de Próximas/Pasadas. La relación con el Doctor se obtiene del expediente con el que se entró, no de una elección libre de profesional.

Fuentes revisadas: [calendario visible](src/app/pages/calendar/calendar.html), [datos mostrados](src/app/pages/calendar/calendar.ts), [detalle](src/app/shared/components/appointment-detail-card/appointment-detail-card.html).

## 4. Navegación principal

| Opción | Propósito | Mobile |
|---|---|---|
| Calendario | Consultar agenda familiar y reservar si está permitido | Barra inferior; vista de día |
| Pacientes | Ver niños asociados y abrir documentos de cada uno | Barra inferior; tarjetas de una columna |
| Ver historial | Desde tarjeta del niño o detalle de cita: documentos vigentes | Misma página de documentos adaptable |
| Perfil, icono de cuenta del encabezado | Correo de acceso, nombres de pacientes asociados y Cerrar sesión; solo lectura | Página completa dentro del portal; segunda pulsación del icono vuelve al Calendario |
| Marca Lilcare | Volver al Calendario del portal | Misma finalidad |
| Icono de cuenta | Cerrar sesión | Mismo control |

No hay Pacientes → Agregar/Editar, Vacunas, Gráficas, Asistentes, Impresión de ajustes o Configuración. No confundir «Pacientes» del tutor con el directorio editable del Doctor.

Fuentes revisadas: [menú](src/app/shared/components/sidebar/sidebar.html), [encabezado](src/app/shared/components/header/header.ts), [campana](src/app/shared/components/notification-bell/notification-bell.ts).

## 5. Funciones disponibles

### 5.1 Consultar citas familiares, anteriores y futuras

**Objetivo:** revisar cuándo están agendados sus hijos.

**Cómo llegar:** entrar → Calendario; o Calendario en la navegación.

**Pasos:**

1. Elige fecha desde el encabezado.
2. Revisa semana desktop o día mobile.
3. Abre bloque/tarjeta de su niño.
4. Consulta motivo o usa Ver historial.
5. Pulsa Hoy cuando esté disponible para volver a la semana actual.

**Campos:** fecha de navegación; nombre, hora en tarjetas móviles y motivo de la cita cuando existe. Son lectura.

**Acciones:** cambiar fecha no cambia reserva; abrir detalle no cancela; Ver historial abre documentos del niño. No hay botones normales de flechas semanales en el template actual.

**Resultado esperado:** reservas familiares de la fecha elegida; otros pacientes no aparecen como propios.

**Validaciones:** navegar al pasado está permitido; crear una cita pasada no. No hay listas separadas «Próximas» y «Pasadas» confirmadas.

**Mensajes / estados especiales:** una cita cancelada no se muestra en la agenda habitual; ausencia de reservas no habilita automáticamente agendar.

**Mobile:** tarjetas del día y detalle expandido.

**Dependencias con otros roles:** reservas creadas/cambiadas por el consultorio; configuración decide si el tutor puede actuar.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [calendario](src/app/pages/calendar/calendar.ts), [presentaciones](src/app/pages/calendar/calendar.html).

### 5.2 Agendar una consulta

**Objetivo:** reservar una hora disponible para un niño asociado al acceso.

**Cómo llegar:** Calendario → Agendar consulta; desktop también pulsar celda libre/permitida.

**Pasos:**

1. Abre formulario.
2. Si tiene varios hijos, busca y selecciona al niño.
3. Elige Día disponible.
4. Elige Hora libre.
5. Escribe motivo si desea.
6. Pulsa Agendar.

**Campos:**

| Campo | Regla |
|---|---|
| Paciente / Buscar paciente | Solo niños del grupo. Un único hijo aparece fijo; varios permiten selección. No hay Añadir nuevo paciente |
| Día | Requerido, hoy o futuro dentro de disponibilidad semanal |
| Hora | Requerida, opciones por segmentos/duración y ocupación |
| Motivo de la consulta (opcional) | Texto hasta cien caracteres, contador |

**Acciones:** Agendar registra directamente; X cierra sin guardar. No existe Confirmar solicitud por otro rol como paso posterior ni campo para elegir otro Doctor.

**Resultado esperado:** «Cita agendada», cierre del formulario y reserva en calendario. Se generan avisos al Doctor/asistentes/familia.

**Validaciones:** requiere permiso de reservas del Doctor. Día pasado o cerrado deshabilitado. Hoy solo horas posteriores a la hora actual del centro de México, aunque el dispositivo use otra zona; cada consulta debe caber entera en un segmento. Las ocupadas no se ofrecen. Al cambiar Día se limpia una Hora que dejó de ser válida; si sigue disponible, se conserva. Las opciones se actualizan al cambiar el minuto o volver a la página. Antes de guardar se recalculan: una hora de hoy que ya pasó durante la edición también impide guardar. Muestra «Selecciona una hora disponible dentro del horario del doctor para el día elegido.» si la hora no pertenece al horario válido. Si el día ya no tiene horarios, indica «Selecciona un día con horarios disponibles del consultorio.». La fecha/hora elegida corresponde al consultorio y se conserva al guardar. Aplica al agendar y reagendar. CONFIRMADO en P21/P28; fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, `src/app/core/utils/clinic-time.ts` y sus pruebas.

**Mensajes / estados especiales:** «Selecciona un paciente de los resultados de búsqueda.», «Selecciona un día», «Selecciona una hora», «Esa hora ya está ocupada. Elige otra hora disponible.» y mensaje de día no disponible. Sin opciones no hay un botón de lista de espera o contacto automático confirmado.

**Selección entre varios niños:** elegir un resultado completa la selección. Editar o borrar el texto después la retira y exige elegir de nuevo antes de Agendar; escribir el mismo nombre no basta. Enfocar el buscador conserva la selección. El niño único y el paciente de una reagenda permanecen fijos. CONFIRMADO en P24; fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, su template y sus pruebas.

**Mobile:** panel inferior y selectors; crear sí está conectado. No inventar un formulario de solicitud separado.

**Dependencias con otros roles:** Doctor/Asistente configuran segmentos; solo el Doctor habilita reservas del Paciente. Si no ve Agendar debe gestionar el contacto fuera del flujo; ese canal no está definido en el código.

Si el consultorio guarda todos los días de la semana cerrados, no hay fechas ni horas disponibles para reservar, aunque el Doctor mantenga habilitada la opción de agendar. Las citas existentes se conservan; no se cancelan automáticamente por cerrar disponibilidad. CONFIRMADO en el código y autorizado en P25; fuentes: `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, `src/app/pages/calendar/p25-closed-week.spec.ts`.

**Estado de certeza:** CONFIRMADO en el procedimiento de reserva descrito.

Fuentes revisadas: [entrada/condiciones](src/app/pages/calendar/calendar.ts), [formulario](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [horas/días](src/app/core/utils/availability.ts).

### 5.3 Reagendar una cita propia

**Objetivo:** cambiar fecha/hora o motivo sin cambiar el niño.

**Cómo llegar:** Calendario → cita del niño → Reagendar, cuando el Doctor permite reservas.

**Pasos:**

1. Abre detalle.
2. Pulsa Reagendar.
3. Conserva Día/Hora o elige otros disponibles y ajusta motivo si corresponde.
4. Confirma Reagendar.

**Campos:** paciente fijo; día/hora obligatorios; motivo opcional hasta cien caracteres.

**Acciones:** Reagendar guarda; X conserva la reserva existente al abandonar formulario.

**Resultado esperado:** «Cita actualizada» y aviso de reagenda si cambió día/hora. Cambiar solo motivo no genera ese aviso.

**Validaciones:** paciente asociado y reservas habilitadas. La cita propia no cuenta como ocupación: puedes conservar exactamente fecha/hora y cambiar solo motivo, incluso si después cambió la disponibilidad, cerró el día o la cita es pasada. Otra cita vigente a esa hora sí impide conservarla, incluida una reserva familiar. Una nueva fecha/hora exige disponibilidad actual. No se reactivan canceladas/deshabilitadas. Las opciones se actualizan mientras está abierto; la excepción no habilita reservas desactivadas. CONFIRMADO en código y regresiones locales P20.

**Mensajes / estados especiales:** no se comprobó una anticipación mínima propia de reagenda. Si el Doctor desactiva reservas, también desaparecen Reagendar y Cancelar del detalle.

**Mobile:** selecciona el día, pulsa la tarjeta de la cita propia y después Reagendar. El detalle se cierra y se abre un panel inferior con el paciente fijo y los datos precargados. Elige día/hora disponibles y confirma; X conserva la reserva anterior. Mantiene las validaciones de desktop. Si el Doctor no permite reservas, Reagendar no aparece y el calendario tampoco abre este formulario.

**Dependencias con otros roles:** consultorio recibe cambio; un bloqueo de reservas puede requerir intervención del Doctor/Asistente por fuera del portal.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [acciones por rol](src/app/shared/components/appointment-detail-card/appointment-detail-card.html), [evento móvil/desktop](src/app/pages/calendar/calendar.html), [opciones en edición](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts).

### 5.4 Cancelar una cita propia

**Objetivo:** retirar una reserva familiar que ya no utilizará.

**Cómo llegar:** Calendario → cita → Cancelar, si el Doctor permite reservas.

**Pasos:**

1. Pulsa Cancelar.
2. Lee «Cancelar consulta» y aviso de notificación al Doctor.
3. Pulsa Cancelar consulta para aceptar o Cerrar para conservarla.

**Campos:** no requiere motivo ni nueva fecha.

**Acciones:** botón peligroso cancela; Cerrar abandona confirmación. No crea una cita sustituta automáticamente.

**Resultado esperado:** «Cita cancelada», reserva retirada y Doctor notificado mediante el módulo de avisos.

Al recibir la cancelación, ese horario queda libre para una nueva reserva si no hay otra cita vigente en la misma fecha/hora y sigue dentro de la disponibilidad del Doctor. Las canceladas no cuentan como ocupación. Si Agendar está abierto, su lista de horas se actualiza sin cerrarlo; no selecciona ni crea una nueva cita automáticamente. Esta regla también se aplica al elegir una hora libre desde la reagenda disponible.

**Validaciones:** la acción depende del mismo permiso que habilita Agendar. No hay una regla de anticipación/cargo por cancelación identificada.

**Mensajes / estados especiales:** «Al cancelar una consulta el o la doctora recibirá una notificación de la cancelación.».

**Mobile:** acción de cancelar sí conectada, confirmación modal adaptable.

**Dependencias con otros roles:** Doctor/Asistente también pueden cancelar; desactivar reservas impide la acción del tutor desde el detalle actual.

**Estado de certeza:** CONFIRMADO para el procedimiento descrito.

Fuentes revisadas: [cancelación](src/app/pages/calendar/calendar.ts), [permiso visible](src/app/shared/components/appointment-detail-card/appointment-detail-card.html).

### 5.5 Consultar niños asociados y documentos vigentes

**Objetivo:** identificar sus hijos y leer recomendaciones/recetas disponibles.

**Cómo llegar:** Pacientes → tarjeta → Ver historial; también Calendario → cita → Ver historial.

**Pasos:**

1. Revisa tarjetas con nombre, edad y padres/tutores.
2. Abre Ver historial del niño correcto.
3. Abre Recomendaciones y/o Receta y revisa los documentos vigentes disponibles, ordenados del más reciente al más antiguo.
4. Revisa fecha «Visible para el paciente hasta el».
5. Regresa por Pacientes del breadcrumb.

**Campos:** lectura: identidad del niño, edad, tutores, documentos enriquecidos y fechas de vigencia. No hay una pantalla para editar contactos o antecedentes.

**Acciones:** Ver historial abre documentos; las pestañas separan Recomendaciones y Receta. Cada documento muestra su fecha de consulta, vigencia y botón Imprimir. No existe el selector de consultas clínicas completas que utiliza el Doctor.

**Resultado esperado (P48, decisión del usuario):** el portal muestra **todos los documentos vigentes** del niño autorizado. Dos recetas o recomendaciones activas, incluso del mismo día, permanecen disponibles. Se ordenan primero por día de consulta y, dentro del mismo día, por su creación original; editar un documento anterior no lo coloca por encima de uno creado después. Recomendaciones y recetas tienen vigencias independientes. No se muestran documentos vencidos ni el historial clínico privado completo.

**Validaciones:** acceso solo a niños del grupo del mismo doctor/correo; la fecha límite incluye ese día en la hora del centro de México. Al cambiar el día del consultorio, una vista abierta oculta el documento vencido; no requiere un cambio de cita o de expediente. Si un documento antiguo no tiene fecha límite, se considera visible. Un documento vacío no produce pestaña por sí solo.

**Mensajes / estados especiales:** «No tienes pacientes asociados.» en listado. «Por el momento no cuentas con recomendaciones o recetas por consultar.» cuando no hay documentos vigentes con contenido.

**Mobile:** tarjetas de una columna; página de historial con breadcrumb que envuelve, textos y pestañas adaptables. Sigue en lectura.

**Dependencias con otros roles:** Doctor escribe documentos y fechas; Asistente no lo hace. El tutor no puede prorrogar, corregir ni solicitar renovación mediante un botón identificado.

**Estado de certeza:** CONFIRMADO en código y aprobado por el usuario para P48; comprobación visual pendiente.

Fuentes revisadas: [niños asociados](src/app/pages/patient-patients/patient-patients.ts), [historial del portal](src/app/pages/patient-history-view/patient-history-view.ts), [contenido visible](src/app/pages/patient-history-view/patient-history-view.html).

### 5.6 Imprimir recomendaciones o receta visibles

**Objetivo:** obtener una copia del documento que el Doctor dejó disponible.

**Cómo llegar:** Pacientes → Ver historial → Recomendaciones o Receta → Imprimir.

**Pasos:**

1. Abre la pestaña del tipo de documento y localiza el documento vigente por su fecha/contenido.
2. Pulsa el botón Imprimir de ese documento, aunque sea anterior a otro de la misma pestaña.
3. Permite la pestaña emergente.
4. Usa las opciones de impresión del navegador.

**Campos:** no captura datos; imprime el texto/enriquecido del documento elegido.

**Acciones:** Imprimir abre otra ventana y solicita impresión; cancelar allí no cambia documentos o cita. Guardar PDF solo si el navegador lo ofrece; no hay exportación propia de Lilcare identificada.

**Resultado esperado:** Carta vertical con margen de 2.5 cm, sin logo ni encabezado profesional generado como el formato del Doctor. No incluir por defecto todos los datos del niño o ambas secciones juntas.

**Validaciones:** documento presente/visible; popups y soporte de impresión del navegador.

**Mensajes / estados especiales:** la impresión requiere permitir ventanas emergentes en el navegador.

**Mobile:** controles del navegador/sistema; resultado no se verificó en dispositivos. Capturar por separado si impresión móvil se considera soportada.

**Dependencias con otros roles:** contenido y vigencia del Doctor; su configuración/logo no gobiernan este formato del portal.

**Estado de certeza:** CONFIRMADO en generación; disponibilidad física/PDF y paginación REQUIEREN VALIDACIÓN.

Fuentes revisadas: [impresión del portal](src/app/pages/patient-history-view/patient-history-view.ts), [botones](src/app/pages/patient-history-view/patient-history-view.html).

### 5.7 Cerrar sesión

**Objetivo:** finalizar el acceso al portal.

**Cómo llegar:** icono de cuenta → Cerrar sesión.

**Pasos:**

1. Abre el control de cuenta.
2. Pulsa Cerrar sesión.
3. El sistema abre Acceso paciente; para volver a entrar utiliza el correo y la contraseña proporcionados por el consultorio.

**Campos:** ninguno.

**Acciones:** Cerrar sesión termina el acceso. Cerrar o recargar la pestaña también pierde la sesión en memoria; deberá ingresar de nuevo.

**Resultado esperado:** sesión terminada y retorno directo a Acceso paciente (`/patient-login`), tanto desde el diálogo desktop como desde la página mobile.

**Validaciones:** no solicita una nueva contraseña ni confirmación adicional.

**Mensajes / estados especiales:** Acceso paciente es la entrada destinada al tutor.

**Mobile:** mismo control de cierre; no modifica los expedientes asociados.

**Dependencias con otros roles:** ninguna para cerrar sesión; recuperación de acceso depende del consultorio.

**Estado de certeza:** CONFIRMADO en la acción de cierre.

Fuentes revisadas: [cuenta](src/app/shared/components/header/header.ts), [cierre del Paciente](src/app/shared/components/patient-profile/patient-profile.ts).

### 5.8 Consultar el perfil del acceso

**Objetivo:** comprobar el correo utilizado para entrar y los nombres de los pacientes asociados a ese acceso.

**Cómo llegar:** icono de cuenta del encabezado → Perfil.

**Pasos:**

1. Pulsa el icono de cuenta.
2. Lee Correo de acceso; puede ser el correo principal o secundario utilizado para entrar.
3. Espera la carga de Pacientes asociados y consulta sus nombres.
4. En desktop, cierra con X para continuar sin salir. En mobile, pulsa otra vez el icono para volver al Calendario, o utiliza la navegación Calendario/Pacientes.

**Campos:** Correo de acceso y nombres de los pacientes; ambos son de lectura. No solicita datos ni muestra contraseña, datos clínicos, logo o nombre supuesto del tutor.

**Acciones:** X cierra el diálogo sin terminar la sesión; Reintentar vuelve a consultar los pacientes después de un error; Cerrar sesión realiza la operación de 5.7. No hay Editar perfil ni enlaces al historial dentro de esta lista.

**Resultado esperado:** lista de pacientes que comparten el correo de acceso como principal o secundario con el mismo Doctor del acceso actual.

**Validaciones:** requiere sesión de Paciente, correo identificable y Doctor asociado. No ofrece elección de Doctor ni incorpora pacientes de otros consultorios.

**Mensajes / estados especiales:** «Cargando pacientes asociados…» durante la lectura; «No hay pacientes asociados a este acceso.» si la consulta termina sin resultados; «No fue posible cargar los pacientes asociados. Intenta nuevamente.» con Reintentar si falla. Si falta la asociación o el correo, indica «No fue posible identificar los pacientes de este acceso. Consulta al consultorio.». El aviso para actualizar datos es «Para actualizar tus datos o los de los pacientes, contacta al consultorio.».

**Mobile:** hasta 768 px abre la página Perfil dentro del portal, con correo que puede envolver y botón Cerrar sesión a ancho disponible. No abre el perfil del personal ni un segundo panel de edición. Desktop y tablet por encima de 768 px usan un diálogo con X y lista desplazable si es larga.

**Dependencias con otros roles:** el Doctor mantiene correos y expedientes; esta pantalla no cambia esos datos ni crea un perfil independiente para el tutor.

**Estado de certeza:** CONFIRMADO en implementación y pruebas locales del 9 de octubre de 2026; presentación visual pendiente de validar antes de capturas oficiales.

Fuentes revisadas: [perfil de lectura](src/app/shared/components/patient-profile/patient-profile.ts), [contenido](src/app/shared/components/patient-profile/patient-profile.html), [página mobile](src/app/pages/patient-profile-page/patient-profile-page.ts), [encabezado](src/app/shared/components/header/header.ts), [rutas](src/app/app.routes.ts).

## 6. Flujos completos

| Flujo | Secuencia / límite |
|---|---|
| Acceso familiar | Consultorio crea niño → correo/contraseña → Acceso paciente → Entrar → Calendario de su grupo y doctor |
| Reservar | Calendario → Agendar visible → elegir hijo si varios → Día abierto → Hora libre → motivo opcional → Agendar → cita registrada |
| Reagendar desktop/mobile | Cita propia → detalle → Reagendar → paciente fijo → día/hora → guardar → aviso |
| Cancelar | Cita propia → Cancelar visible → confirmación → Cancelar consulta → retirada; no reserva nueva automática |
| Consultar documentos | Pacientes → niño → Ver historial → documento vigente seleccionado → leer/Imprimir |
| Vigencia de documentos | El portal muestra los documentos vigentes de la consulta seleccionada, según la fecha límite definida por el Doctor |
| Recuperar acceso | Contactar consultorio por canal externo acordado → Doctor regenera → correo/valor nuevo → Acceso paciente; no autogestión en portal |
| Salir | Icono cuenta → Cerrar sesión → Acceso paciente → correo/contraseña para una nueva sesión |
| Consultar acceso | Icono cuenta → Perfil → correo y nombres asociados → X en desktop / volver a Calendario en mobile; no edita expedientes |

No añadir solicitud pendiente de aprobación, elección libre de médico, registro propio de medidas/vacunas, edición de tutor, listado completo de atenciones ni selector de todas las recetas antiguas.

## 7. Responsive / mobile

| Área | Desktop | Tablet | Mobile hasta 768 px |
|---|---|---|---|
| Navegación | Lateral Calendario/Pacientes | Conserva patrón con menos espacio | Barra inferior de dos opciones |
| Calendario | Semana/horas | Cuadrícula adaptable | Día y tarjetas |
| Reserva | Panel derecho | Panel adaptable | Panel inferior; Agendar conectado |
| Reagenda | Formulario con paciente fijo | Formulario adaptable | Tarjeta → detalle → Reagendar → panel inferior precargado |
| Cancelación | Confirmación modal | Modal | Conectada, modal adaptable |
| Pacientes asociados | Tarjetas en columnas según ancho | Columnas adaptables | Una columna |
| Documentos | Breadcrumb, tarjeta y pestañas | Márgenes reducidos | Breadcrumb envuelve; texto adaptable, lectura |
| Perfil y cierre de sesión | Diálogo con X, correo y nombres asociados | Diálogo por encima de 768 px | Página completa Perfil; icono vuelve al Calendario; Cerrar sesión a ancho disponible |

No se encontró una experiencia instalable de PWA, botón Instalar, modo offline o trabajo sin conexión configurados como función del portal. No ofrecerlos como prestaciones del manual. La capacidad de añadir un sitio a inicio que tenga un navegador es externa a la UI investigada.

Fuentes revisadas: [estilos de pacientes asociados](src/app/pages/patient-patients/patient-patients.scss), [documentos](src/app/pages/patient-history-view/patient-history-view.scss), [calendario](src/app/pages/calendar/calendar.scss), [encabezado](src/app/shared/components/header/header.ts), configuración de aplicación e index revisados para evidencia de instalación.

## 8. Empty states

| Lugar | Mensaje / motivo posible | Acción visible |
|---|---|---|
| Calendario móvil | «No tienes consultas agendadas para este día.» | Agendar solo si permitido; cambiar fecha |
| Pacientes asociados | «No tienes pacientes asociados.» | Sin botón Agregar; requiere gestión del consultorio |
| Documentos | «Por el momento no cuentas con recomendaciones o recetas por consultar.» | Sin editor/solicitud de documento; volver a Pacientes |
| Perfil | «No hay pacientes asociados a este acceso.» después de una consulta correcta | Sin Agregar/Editar; contactar al consultorio |

| Horas disponibles | Lista sin opciones posibles | Elegir otra fecha; no lista de espera confirmada |

Ausencia de documentos puede significar contenido no escrito, vencido o selección de otra consulta; no equivale a que el niño nunca haya sido atendido.

## 9. Confirmaciones y acciones destructivas

- Cancelar consulta: sí, modal y aviso al Doctor; aceptar cancela reserva; Cerrar conserva.
- Reagendar/Agendar: confirmar en botón de formulario, sin otra revisión final obligatoria identificada. X abandona borrador sin confirmación universal.
- No hay eliminar paciente, borrar registro médico o eliminar cuenta desde portal.

- Cerrar sesión: directo, sin confirmación adicional.
- Imprimir/cancelar impresión: no altera la información ni cancela la cita.

## 10. Estados read-only y editables

- Identidad, edad y tutores en tarjetas/documentos: lectura.
- Historial visible: lectura de recomendaciones/receta; sin medidas, diagnóstico, antecedentes, vacunas o gráficas editables/consultables allí.
- Reserva con un hijo: paciente fijo; varios: seleccionable entre asociados. Reagenda: fijo.
- No selección de Doctor o ajuste de duración/segmentos.
- Reserva/edición/cancelación no visible si el Doctor no permite agendar, aunque sí puede leer calendario/documentos.
- Campo motivo editable en reserva/reagenda; no es edición del motivo clínico de la atención.
- El tutor no edita su expediente; los datos los mantiene el Doctor.
- Perfil del acceso: correo y nombres de pacientes solo lectura; no permite editar correo, nombre, contraseña o logo.

## 11. Validaciones

| Contexto | Regla |
|---|---|
| Acceso | Correo requerido válido, contraseña requerida/igual a la provista; no fuerza ocho caracteres al tutor |
| Sesión | Una hora de inactividad como máximo; sesión solo en memoria. Recargar o cerrar la pestaña requiere entrar nuevamente. Al vencer abre Acceso paciente y cierra los diálogos abiertos del portal |
| Contraseña | Reutilizable, sin vencimiento temporal; la nueva reemplaza a la anterior cuando el Doctor la renueva |
| Familia | Mismo correo de acceso principal/secundario y mismo doctor para lista de hijos |
| Reserva | Selección de hijo, día/hora; no pasado; hoy futuro; segmentos abiertos; ocupación; motivo cien caracteres |
| Reagenda | Misma regla de disponibilidad y permiso del Doctor en desktop/mobile |
| Cancelación | Permiso de reservas del Doctor; confirmación; sin plazo/motivo comprobados |
| Documentos | Texto no vacío y vigencia hoy o posterior; sin fecha antigua se considera vigente |
| Impresión | Documento disponible y ventanas emergentes permitidas |

No hay validación de datos médicos solicitada al Paciente porque no tiene formularios clínicos. La referencia horaria confirmada del consultorio es la hora del centro de México. No inventar políticas de anticipo, multas o límites de citas por hijo.

## 12. Estados de carga y error

- Acceso: Entrar bloqueado/spinner mientras verifica; errores dentro de pantalla.
- Pacientes asociados: barra de progreso mientras carga.
- Perfil del acceso: spinner y mensaje de carga; error diferenciado de lista vacía, con Reintentar. Cerrar sesión muestra spinner y bloquea su botón y el cierre del diálogo mientras procesa; si falla, alerta «No fue posible cerrar sesión. Intenta nuevamente.» y permite volver a intentarlo.
- Historial: barra de progreso mientras carga.
- Reserva: spinner, campos con errores y mensaje de guardado dentro del panel; no reintento automático confirmado.
- Cancelación: éxito «Cita cancelada».
- Impresión: popup bloqueado puede no producir respuesta visible.
- No estado offline/cola de sincronización ni soporte integrado confirmado.
- Al terminar la sesión por inactividad, vuelve a Acceso paciente; no hay un aviso previo con cuenta regresiva. Los borradores abiertos sin guardar se abandonan al cerrar los diálogos del portal.

## 13. Notificaciones

No se incluye un procedimiento de notificaciones para el Paciente en esta edición del contexto funcional.

## 14. Perfil

Desde el icono de cuenta abre un perfil propio de lectura del acceso, con correo y nombres de pacientes asociados. En desktop es diálogo; hasta 768 px es una página del portal. El procedimiento y sus estados se detallan en 5.8. No representa una nueva cuenta o ficha independiente del tutor.

El tutor consulta nombre, edad y padres/tutores del niño en Pacientes y en los documentos disponibles. Los datos del expediente los mantiene el Doctor. No tiene edición autónoma de correo, contraseña, antecedentes, foto o logo.

El cierre de sesión se describe en 5.7.

## SCREENSHOTS RECOMENDADOS PARA EL MANUAL

- [ ] Dos recetas y dos recomendaciones vigentes del mismo día, todas accesibles; desktop/mobile.
- [ ] Reservas habilitadas/deshabilitadas: Agendar/Reagendar/Cancelar presentes o ausentes coherentemente.
- [ ] Reagenda conservando horario original con disponibilidad cambiada, y bloqueo por otra cita vigente.
- [ ] Retorno a Acceso paciente al cerrar o vencer sesión; sin credenciales visibles.

- [ ] Acceso paciente con hint y validaciones; desktop/mobile, contraseñas ocultas.
- [ ] Calendario familiar desktop con horas de terceros sin nombres ajenos.
- [ ] Calendario diario y detalle mobile.
- [ ] Encabezado con Agendar permitido y sin Agendar cuando está deshabilitado.
- [ ] Datepicker con días no disponibles y lista de horas libres.
- [ ] Intento de agendar con toda la semana cerrada: días no seleccionables y sin horas; desktop/mobile.
- [ ] Agendar con un niño fijo y con varios niños seleccionables; desktop/mobile.
- [ ] Agendar con varios niños: editar texto tras seleccionar, mensaje de elegir resultado y botón bloqueado; desktop/mobile.
- [ ] Reagendar con paciente fijo y datos precargados: desktop/mobile; conservar fecha/hora editando solo motivo; variante con reservas deshabilitadas sin ese botón.
- [ ] Confirmación de cancelación con aviso al Doctor.
- [ ] Pacientes asociados con uno y varios hijos; desktop/mobile.
- [ ] Empty state sin niños asociados.
- [ ] Historial con Recomendaciones/Receta y fechas de visibilidad; desktop/mobile.
- [ ] Dos recetas y dos recomendaciones vigentes del mismo día, ordenadas por creación e impresión individual; desktop/mobile.
- [ ] Vencimiento de un documento con otro del mismo tipo aún disponible; desktop/mobile.
- [ ] Impresión del documento anterior elegido, usando contenido sintético diferente al del más reciente.
- [ ] Solo una pestaña vigente y estado sin documentos disponibles.
- [ ] Salida impresa de receta/recomendaciones sin logo, usando texto ficticio.
- [ ] Control de cuenta y Cerrar sesión; desktop/mobile.
- [ ] Perfil de lectura desktop con correo secundario y varios pacientes ficticios.
- [ ] Página Perfil mobile y navegación de regreso al Calendario.
- [ ] Perfil sin pacientes asociados y error de carga con Reintentar.
- [ ] Regreso a Acceso paciente tras una hora de inactividad, desktop/mobile.

## INFORMACIÓN QUE NO PUDE CONFIRMAR DESDE EL CÓDIGO

1. ¿Cuál es el canal concreto para recuperar acceso o reservar cuando Agendar no aparece?
2. ¿Quién verifica que los correos pertenecen a tutores autorizados?
3. ¿Qué política de anticipación, cancelación o número máximo de citas debe comunicarse?
4. ¿A quién solicita el tutor renovación de una receta o recomendación?
5. ¿Qué navegadores móviles e impresión/PDF del portal están soportados?
6. ¿Qué instrucciones de contacto debe seguir una familia atendida por más de un consultorio?
