# LILCARE — CONTEXTO FUNCIONAL COMPARTIDO

**Confirmaciones externas — 10 de octubre de 2026:** el usuario informa que los correos funcionan correctamente, acepta conservar las notificaciones actuales y comunica la confirmación del Doctor sobre curvas de crecimiento y esquema de vacunación. Los seguimientos D09, notificaciones y P37/D11 quedan cerrados por esas confirmaciones. No se ejecutaron nuevos ensayos externos ni clínicos por el agente.

**Revisión vigente: 10 de octubre de 2026 (P46).** Fuente principal: código actual y regresiones locales. Los cuatro contextos describen experiencias de usuario implementadas; no se han capturado pantallas ni probado cuentas reales en esta revisión. Los apartados fechados al inicio conservan la referencia histórica de la investigación.

Documento de investigación para preparar cuatro manuales de usuario. No es el manual final. Auditoría estática del repositorio local, cerrada el 4 de octubre de 2026, referencia de código 76791ac. No se ejecutaron operaciones sobre cuentas o datos reales, ni se capturaron pantallas. Los mensajes citados son textos de la interfaz; los ejemplos deben usar datos ficticios al ilustrarse.

Actualización funcional autorizada el mismo día: el Asistente puede ajustar disponibilidad y duración, pero la opción de permitir reservas del Paciente es exclusiva del Doctor. Los contextos de Doctor, Asistente y Paciente incorporan este cambio local posterior a la referencia inicial.

Actualización local P44/P45 del 9 de octubre de 2026: Admin tiene navegación Doctores → Administradores → Bitácora; entra inicialmente a Doctores. Puede invitar/gestionar otras cuentas administrativas, sin baja propia y conservando un Admin operativo. Los servicios del personal fueron publicados y habilitados en D10; el ensayo externo sigue omitido por D09. Ver [contexto del Administrador](ADMIN_OPERATIONS_CONTEXT.md).

## Cómo interpretar esta investigación

- **CONFIRMADO:** la pantalla, su acción y las condiciones descritas pueden seguirse en el código actual. Esto confirma la implementación, no una prueba visual o una operación exitosa en producción.
- **APARENTE / REQUIERE VALIDACIÓN:** información funcional inferida que debe confirmarse antes de usarla en el manual final.
- **NO DETERMINABLE DESDE EL CÓDIGO:** políticas, decisiones o condiciones del entorno que el repositorio no permite establecer.

Las referencias al código son evidencia para quienes redactarán los manuales. No deben aparecer como instrucciones técnicas al usuario. Los cuatro documentos por rol describen los procedimientos verificados; este archivo fija sus reglas y términos comunes.

## Inventario general de roles

| Rol funcional | Identificación interna | Acceso | Pantalla inicial con registro completo | Navegación principal | Límites visibles |
|---|---|---|---|---|---|
| Doctor | doctor, cuenta de personal | Correo y contraseña en Iniciar sesión | Calendario | Calendario, Pacientes, Asistentes, Impresión; perfil y campana en encabezado | No gestiona otros doctores ni administradores desde la navegación normal |
| Administrador | admin, cuenta de personal | Mismo acceso del personal; invitación de otro Admin para nuevas cuentas | Doctores | Doctores, Administradores, Bitácora (última); perfil sin campana | No entra a Calendario, Pacientes, historiales o Impresión; no puede actuar como Doctor desde la UI ni darse de baja |
| Asistente | assistant, asociado al doctor que lo invitó | Mismo acceso del personal | Calendario del doctor asociado | Calendario, Configuración de horarios, Agendar consulta; perfil y campana; sin barra principal lateral/inferior | No entra a listado/perfil/historial clínico de pacientes, Asistentes o Impresión. Puede dar de alta pacientes dentro de una cita y modificar horarios: estas excepciones están implementadas |
| Paciente / tutor | Sesión patient asociada a un expediente infantil; no es un cuarto valor de rol del personal | Correo principal o secundario y contraseña proporcionada por el consultorio, en Acceso paciente | Calendario | Calendario, Pacientes y Perfil de lectura con cierre de sesión | No administra expedientes ni registra datos médicos. Ve recetas/recomendaciones vigentes, no el historial completo. Agenda/reagenda/cancela cuando el doctor lo permite |

**CONFIRMADO:** un perfil incompleto del personal conduce a completar registro antes de su entrada habitual. El Administrador no tiene un selector para entrar como Doctor. Comparten el patrón de directorios: Doctor gestiona sus Asistentes; Admin gestiona Doctores y Administradores en áreas independientes.

**Actualización local del 8 de octubre de 2026:** el calendario del Asistente comprueba que su Doctor asociado exista, tenga rol Doctor y haya completado el registro sin estar pendiente. Mientras comprueba muestra un estado de carga; si la asociación no es válida o falla la comprobación ofrece Reintentar y Cerrar sesión. Reintentar vuelve a leer la asociación, sin escribir/reasignar perfiles. No permite agendar/configurar desde el aviso. Ver [operación del Asistente](ASSISTANT_OPERATIONS_CONTEXT.md#59-reintentar-el-acceso-a-una-agenda-no-disponible).

Fuentes revisadas: [rutas](src/app/app.routes.ts), [acceso y sesión](src/app/core/services/auth.service.ts), [menú](src/app/shared/components/sidebar/sidebar.html), [calendario](src/app/pages/calendar/calendar.ts), [perfil](src/app/shared/components/profile-dialog/profile-dialog.html).

**Actualización local P14 (9 de octubre de 2026):** con una sesión de personal autorizada, la entrada general `/app` lleva al Administrador a Doctores y al Doctor/Asistente al Calendario, tanto en desktop como mobile. Conserva las restricciones de cada área; el Paciente usa su portal. Confirmado por pruebas de navegación locales, sin despliegue. Fuentes: `src/app/app.routes.ts`, `src/app/app.routes.spec.ts`.

**Actualización local P15 (9 de octubre de 2026):** el Paciente abre un perfil de lectura desde el icono de cuenta: correo utilizado para entrar y nombres de pacientes asociados al mismo correo y Doctor. Desktop usa diálogo; hasta 768 px usa página del portal. Sin edición, datos médicos o logo; Reintentar ante fallo de carga y Cerrar sesión. Fuentes: `src/app/shared/components/patient-profile/`, `src/app/pages/patient-profile-page/patient-profile-page.ts`, `src/app/shared/components/header/header.ts`.

**Actualización local P16 (9 de octubre de 2026):** Cerrar sesión desde el perfil del Paciente vuelve directamente a Acceso paciente (`/patient-login`) en desktop y mobile. Fuente: `src/app/shared/components/patient-profile/patient-profile.ts`.

**Sesiones vigentes (P01/P17):** los cuatro roles tienen una hora máxima sin interacción. El personal conserva el tiempo restante al recargar. El Paciente tiene sesión únicamente en memoria: recargar o cerrar la pestaña requiere entrar nuevamente; volver a una pestaña todavía abierta comprueba el plazo restante. Paciente sale a Acceso paciente; personal a Login. La contraseña del Paciente se reutiliza hasta que el Doctor la renueva, aunque termine la sesión. La renovación invalida los accesos ligados a la credencial anterior. Fuentes: `src/app/core/services/auth.service.ts`, `functions/src/clinic-patient-portal.ts`, `functions/src/clinic-leases.ts`.

## Condiciones de disponibilidad para los futuros manuales

**CONFIRMADO en código y pruebas locales; publicación/habilitación verificadas en D10:** acceso del personal y del Paciente, operaciones de agenda/expediente, invitaciones, cambio de correo y bajas están integrados. El dominio del consultorio sirve el artefacto revisado; los servicios se encuentran habilitados. Esta comprobación de publicación no equivale al ensayo funcional externo con cuentas/SMTP, omitido por D09.

Antes de preparar screenshots/manuales oficiales, elegir una versión publicada con esas operaciones habilitadas y datos ficticios autorizados. Confirmar el ambiente con el responsable técnico, sin poner configuración interna en las instrucciones al usuario. El ensayo externo de cuentas/correos está omitido por decisión del usuario; no se presenta como prueba aprobada.

Las decisiones funcionales ya están fijadas: duración de sesión, quién edita perfiles, acceso exclusivo del Doctor a credenciales y datos médicos, restricciones del Asistente y disponibilidad del portal. Las preguntas finales tratan solo información de negocio/entorno que falta; no reabren esas decisiones. Las irregularidades se registran exclusivamente en `PENDIENTES.md`.

Fuentes revisadas: `functions/src/clinic-auth.ts`, `functions/src/staff-invitations.ts`, `functions/src/staff-email-change.ts`, `functions/src/staff-deletion.ts`, `src/app/core/services/auth.service.ts`, `security/p01/AVANCE_INTEGRACION.md`.

## Acceso del Paciente y entrega de correo compartida

- Doctor o Asistente de un Doctor válido dan de alta el expediente; el servidor genera una contraseña de seis caracteres. Nunca se elige manualmente.
- Es única entre las contraseñas activas; sigue válida hasta renovación del Doctor. Una contraseña retirada puede volver a ser generada, sin ser una política de uso único.
- La entrega usa los contactos principal/secundario guardados; si son iguales, solo envía una vez. Permite resultado parcial y reintentar los destinos pendientes sin duplicar alta ni renovar contraseña.
- El Asistente no ve la contraseña. Solo puede reintentar la entrega de su alta original mientras cumple esas condiciones. El Doctor propietario dispone de Ver contraseña, Copiar y Regenerar.
- Cambiar contactos del expediente modifica qué correos permiten acceder y agruparse con hijos del mismo Doctor; no genera una contraseña nueva. Si un acceso deja de estar autorizado, debe iniciar sesión otra vez con información vigente.
- Familia y notificaciones se mantienen dentro del mismo Doctor. Compartir correo con otro consultorio no une sus expedientes.

Fuentes revisadas: `src/app/pages/calendar/dialogs/new-patient-dialog/`, `src/app/pages/patients/dialogs/view-otp-dialog/`, `src/app/pages/patients/patients.ts`, `functions/src/clinic-patients.ts`, `functions/src/clinic-mail.ts`, `functions/src/patient-credentials.ts`.

## Terminología

| Nombre visible / de negocio | Significado en este sistema |
|---|---|
| Lilcare | Nombre mostrado en acceso, marca y encabezado; el repositorio también se denomina pediatrify |
| Doctor(a) | Profesional que mantiene expedientes, agenda, asistentes y documentos de consulta |
| Administrador | Usuario que gestiona Doctores y Administradores y consulta Bitácora; no tiene un tablero clínico |
| Asistente | Personal vinculado a un doctor; opera su calendario y puede registrar un paciente al agendar |
| Paciente | Niño o niña con expediente. En el portal, el correo de acceso normalmente corresponde a padres/tutores |
| Padres o tutores | Nombres de padre y madre registrados en el expediente; no son cuentas independientes con permisos propios |
| Pacientes asociados / familia | Hijos que comparten el correo usado para acceder y están asociados al mismo doctor en el portal |
| Consulta / cita agendada | Reserva de un día y una hora. Los textos usan consulta y cita para la misma operación de agenda |
| Datos por consulta | Registro clínico separado de la reserva: medidas, motivo, diagnóstico, notas, recomendaciones y receta |
| Historial | Para el Doctor: registros clínicos y gráficas. Para el Paciente: documentos vigentes seleccionados; el alcance es menor aunque el enlace tenga el mismo nombre |
| Completar perfil | Agregar antecedentes, contacto y vacunas a un expediente básico; no es la creación de una nueva cuenta del personal |
| Perfil | Puede significar datos del usuario del encabezado o datos generales del niño; el manual debe distinguirlos |
| Reagendar | Cambiar fecha/hora de una cita existente; el paciente permanece fijo |
| Cancelar consulta | Marcar la reserva cancelada y retirarla de la vista habitual; no borra el expediente clínico |
| Eliminar paciente | Borrar el expediente y sus consultas clínicas/citas; puede afectar el acceso del tutor |
| Horario disponible | Día abierto con intervalos en los que cabe una consulta; para el Paciente también debe estar libre |
| Segmento | Intervalo Inicio–Fin de un día semanal. Un día puede tener varios, por ejemplo mañana y tarde |
| Duración de consulta | Intervalo usado para generar opciones de hora; no es un cronómetro de atención |
| Día cerrado | Día semanal sin segmentos. No hay una función visible específica de festivos o excepciones por fecha |
| Permitir que los pacientes agenden citas | Interruptor que habilita las acciones de reserva del portal del Paciente |
| Motivo de consulta | Texto corto opcional en la cita; en Datos por consulta existe un motivo clínico independiente |
| Visible para el paciente hasta | Fecha límite independiente para recomendaciones y receta; incluye ese día |
| Receta / Recomendaciones | Documentos escritos por el Doctor; no equivalen a todos los datos médicos del expediente |
| PC / circunferencia | Perímetro o circunferencia cefálica; la interfaz alterna las denominaciones |
| IMC | Índice de masa corporal calculado a partir de peso y talla en el registro clínico |
| Esquema de vacunación | Marcas de aplicación por vacuna y edad; no un registro completo de lotes o cada aplicación anual |
| Contraseña del Paciente / OTP interno | Contraseña del portal reutilizable, sin vencimiento temporal; permanece válida hasta que el Doctor la renueva. No es un código de un solo uso |
| Invitación | Enlace de un uso y siete días para terminar registro de Doctor, Asistente o Administrador; reenviar invalida el anterior y conserva el pendiente. Quien invita no elige contraseña. Requiere servicio habilitado |
| Logo precargado | Opción de la pestaña Logo en ajustes de impresión |
| Sin leer | Notificaciones aún no marcadas para ese destinatario; los demás usuarios tienen su propio estado |
| Ver detalles | En notificaciones, lleva al Calendario y enfoca la cita; no abre directamente el historial clínico |

Fuentes revisadas: modelos de [usuarios/pacientes/citas](src/app/core/models/user.ts) y [datos clínicos](src/app/core/models/clinical-record.ts); templates de Calendario, Pacientes, Historial, Impresión y portal del Paciente.

## Invitaciones y relación entre roles — actualización local P13

- Administrador prepara Doctor; Doctor prepara sus propios Asistentes. No autorregistro ni selector libre de rol/Doctor; Paciente usa otro acceso.
- Correo registrado o reservado bloquea otro pendiente. Buscar la cuenta existente y usar Reenviar invitación cuando siga pendiente.
- El registro comprueba el enlace; caduca a los siete días y se consume al completar la cuenta. Usado/expirado/reemplazado solicita una invitación nueva.
- Reenviar desde directorio abre panel de identidad de lectura y requiere confirmar; conserva cuenta, reemplaza enlace y reinicia plazo. Reintentar envío ante fallo de correo conserva el enlace y plazo actuales. Se puede copiar, sin prometer recepción de correo.
- Doctor completa profesionales/contraseña; Asistente y Administrador solo contraseña/confirmación. Logotipo del Doctor invitado se agrega desde Perfil después de iniciar sesión.
- Confirmado en implementación local. Servicio deshabilitado por defecto hasta activación coordinada; no presentar como disponible en producción sin comprobar ambiente. No se implementa P45 en este punto.

Fuentes: `src/app/pages/setup-profile/`, `src/app/pages/doctors/dialogs/invite-doctor-dialog/`, `src/app/core/services/staff-invitation.service.ts`, `functions/src/staff-invitations.ts`.

## Elementos compartidos de UI

| Elemento | Uso visible y recomendaciones para explicarlo |
|---|---|
| Botón principal | Botón relleno para continuar, guardar o confirmar. Su texto define la operación: Guardar, Agendar, Crear invitación, etc. |
| Botón secundario | Botón con contorno, usado para alternativas como Cancelar o Editar. No implica que no guarde: verificar el texto |
| Botón terciario | Acción sin contorno, por ejemplo Imprimir, Añadir nuevo segmento o regresar; puede incluir un icono |
| Acción peligrosa | Botón rojo en confirmaciones de eliminación; reservar el lenguaje de irreversible para los borrados reales |
| Menú de tres puntos | Acciones del paciente, doctor o asistente; las opciones dependen del tipo y del estado del registro |
| Panel lateral / drawer | Formulario que se abre por el lado derecho en desktop; permite trabajar sin abandonar la página de origen |
| Bottom sheet | Presentación inferior del formulario en móvil. Hay desplazamiento interno y acciones al pie; no implica que todos los campos queden uno debajo de otro |
| Modal de confirmación | Ventana con explicación y botones de aceptación/cancelación. Cerrar o cancelar normalmente conserva los datos existentes |
| Selector de fecha | Calendario para elegir fecha; en reservas deshabilita pasado y días no disponibles. En otros formularios las restricciones cambian |
| Selector de hora | Lista de horas generadas para el día elegido; no un campo de hora libre en la reserva |
| Autocompletado | Escribir filtra opciones. En Buscar paciente hay que seleccionar un resultado: escribir un nombre no crea ni selecciona por sí solo un paciente. Editar/borrar el texto después de elegir retira la selección y exige elegir de nuevo; enfocar/desplegar conserva la selección. Paciente fijo al reagendar o entrar desde historial |
| Pestañas | Separan datos, recomendaciones, receta, gráficas, vacunas o ajustes. En perfil de paciente en edición, errores pendientes pueden impedir cambiar de pestaña |
| Chips de días | Permiten seleccionar el día que se está configurando; la marca de verificación indica que ese día tiene segmentos |
| Notificación de resultado / alerta | Mensaje temporal con cierre. Puede haber varias a la vez. Un mensaje de fallo de correo después de una creación no implica que la creación se haya revertido |
| Campos con error | Mensaje bajo el campo, normalmente al interactuar o intentar continuar; indica la corrección solicitada |
| Indicador de carga | Barra, rueda o bloques de skeleton según la pantalla. Los botones no usan una regla universal: algunos permiten intentar con campos incompletos y entonces muestran errores |
| Estado vacío | Mensaje cuando no hay registros o documentos visibles; puede incluir Agregar o Agendar. No todos los resultados de búsqueda vacíos tienen un mensaje dedicado |
| Vista previa | En Impresión muestra un ejemplo del formato; no debe interpretarse como el expediente real de un paciente |

No hay una regla universal de confirmar al cerrar formularios. Muchos X, Cancelar o cambios de página descartan la edición sin preguntar.

Fuentes revisadas: [estilos compartidos](src/styles.scss), [alertas](src/app/shared/components/alert-overlay/alert-overlay.html), [selector de paciente y reserva](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.html), [perfil](src/app/shared/components/profile-dialog/profile-dialog.html), [edición de paciente](src/app/pages/patients/dialogs/edit-patient-dialog/edit-patient-dialog.html).

## Reglas generales responsive

| Tamaño | Comportamiento verificado |
|---|---|
| Desktop, generalmente más de 1024 px | Doctor, Admin y Paciente tienen navegación lateral; calendario semanal de siete días; formularios en panel derecho; notificaciones en ventana en la esquina superior derecha para roles que las reciben |
| Tablet, generalmente 769–1024 px | Se reducen márgenes y el espacio disponible. Varias pantallas conservan la presentación desktop; no hay una tercera experiencia universal de tablet |
| Mobile, generalmente hasta 768 px | Doctor, Admin y Paciente cambian a barra inferior. Calendario muestra el día seleccionado con tarjetas; formularios laterales pasan a panel inferior; perfil y notificaciones usan página completa cuando corresponden |
| Pantallas muy estrechas | Hay ajustes adicionales cerca de 400/320 px; textos, botones y formularios pueden envolver. Debe comprobarse la legibilidad con datos largos |

- Asistente no tiene navegación lateral ni barra inferior principal. Admin dispone de tres entradas: Doctores, Administradores y Bitácora.
- En acceso, los botones pasan a disposición vertical. En el calendario del personal, Configuración y Agendar se mantienen como dos acciones en una fila adaptable.
- Formularios con filas ajustables pueden conservar dos campos si hay espacio; no describir todas las vistas móviles como una única columna.
- Las vacunas tienen tabla horizontal con primera columna fija en desktop y listado de dosis por vacuna en móvil.
- Confirmaciones destructivas permanecen modales; no todos los modales pasan a pantalla completa.
- Los cambios visuales de vacunas no cambian su carácter editable o de lectura.
- Perfil móvil: datos en página, edición en panel inferior y cierre de sesión. Doctor edita datos profesionales/logo; Administrador solo correo y Asistente nombre/correo. Cambio de correo requiere activar servicio.
- Perfil del Paciente móvil: correo de acceso y nombres asociados en lectura, sin editor; segunda pulsación del icono vuelve al Calendario. En desktop usa diálogo con X, que conserva la sesión al cerrar.

Fuentes revisadas: [estilos](src/styles.scss), [menú](src/app/shared/components/sidebar/sidebar.scss), [calendario](src/app/pages/calendar/calendar.scss), [perfil móvil](src/app/pages/profile-page/profile-page.ts), [campana](src/app/shared/components/notification-bell/notification-bell.ts), estilos de los diálogos de pacientes.

## Relaciones entre roles

| Relación | Operación confirmada | Precisión necesaria |
|---|---|---|
| Administrador → Doctor | Invita, cambia datos desde su directorio y elimina | Solo Admin incorpora Doctores; no opera agenda clínica desde sus menús |
| Administrador → Administrador | Invita, reenvía pendientes, modifica nombre/correo y da de baja a otra cuenta | No elimina su propia cuenta; debe quedar otro Admin activo con acceso completo. Perfil propio permite solo correo |
| Doctor → Asistente | Invita, reenvía invitación, edita y elimina asistentes propios | El Asistente queda asociado al doctor que lo invitó |
| Doctor → Paciente | Crea expediente, habilita acceso, completa información, registra consultas y documentos | Crear un niño no requiere que el tutor haga un registro inicial |
| Asistente → Paciente | Alta básica desde el formulario de cita | No tiene después un menú para editar perfil o datos clínicos |
| Doctor/Asistente → Calendario | Ambos crean, modifican y cancelan reservas; ambos configuran días, segmentos y duración | Solo el Doctor puede habilitar o deshabilitar que los pacientes agenden; el Asistente no ve esa opción |
| Doctor → Portal del Paciente | Habilita reservas mediante el interruptor y define visibilidad de documentos | Cada receta/recomendación tiene su propia fecha límite |
| Paciente/tutor → Doctor | Agenda para un hijo asociado cuando se permite y consulta documentos vigentes | No es una solicitud con aceptación posterior: se crea una reserva agendada directamente |
| Cita → Participantes | Genera avisos de agenda/cancelación/reagenda al doctor, asistentes y familia | Puede avisar también al actor; el Administrador está excluido |
| Correos compartidos → Familia | Permiten mostrar varios hijos asociados al mismo doctor | El correo principal o secundario registrado puede servir para entrar |

**Baja conjunta del Doctor:** la implementación local de P05 incluye sus Asistentes, accesos y recursos propios cuando el servicio de baja está habilitado. El Administrador ejecuta esa operación desde Doctores; no adquiere una acción independiente de eliminar Asistentes desde otro directorio. Activación y comprobación integrada pendientes; no presentar aún como operación validada en producción.

Fuentes revisadas: [gestión de personas](src/app/pages/doctors/doctors.ts), [invitaciones](src/app/pages/doctors/dialogs/invite-doctor-dialog/invite-doctor-dialog.ts), [alta básica](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts), [portal](src/app/pages/patient-patients/patient-patients.ts), [avisos](src/app/core/services/notification.service.ts).

**Excepción de pruebas P45 (sin operación en la UI):** backend permite que Admin o Doctor incorporen Asistentes. El Asistente creado por Admin queda asociado a ese Admin y no tiene agenda hasta asignarlo a un Doctor válido mediante mantenimiento autorizado. No debe enseñarse como flujo normal del Administrador ni como autorregistro/reasignación del Asistente. Fuentes: `functions/src/staff-invitations.ts`, `src/app/pages/calendar/calendar.ts`.

## Matriz funcional

✓: acción disponible en el flujo normal documentado. —: sin procedimiento documentado para ese rol. Limitado: alcance o condición de uso indicado en las notas.

| Funcionalidad | Admin | Doctor | Asistente | Paciente |
|---|---|---|---|---|
| Iniciar sesión | ✓ | ✓ | ✓ | ✓, acceso distinto |
| Recuperar contraseña por correo desde UI | ✓ | ✓ | ✓ | — |
| Completar registro inicial | Limitado | ✓ | ✓ | — |
| Gestionar doctores | ✓ | — | — | — |
| Gestionar otros administradores | Limitado¹: nombre/correo, invitación y baja restringida | — | — | — |
| Consultar Bitácora | ✓, solo lectura | — | — | — |
| Gestionar asistentes | — | ✓ | — | — |
| Ver calendario | — | ✓ | ✓, doctor asociado | ✓, familia |
| Crear cita | — | ✓ | ✓ | Limitado: habilitación y horas libres |
| Reagendar cita | — | ✓ | ✓ | Limitado: habilitación y disponibilidad del Doctor |
| Cancelar cita | — | ✓ | ✓ | Limitado: habilitación |
| Permitir reservas del Paciente | — | ✓ | — | — |
| Configurar duración/días/segmentos | — | ✓ | ✓ | — |
| Directorio y búsqueda de pacientes | — | ✓ | Limitado: selector al agendar | ✓, hijos asociados |
| Alta básica de paciente | — | ✓ | ✓, dentro de reserva | — |
| Completar/editar perfil del paciente | — | ✓ | — | — |
| Eliminar paciente y datos asociados | — | ✓ | — | — |
| Regenerar contraseña del Paciente | — | ✓ | — | — |
| Consultar/copiar contraseña del Paciente | — | ✓ | — | — |
| Reintentar entrega de acceso del alta | — | ✓ | Limitado: su alta original, sin contraseña | — |
| Consultar historial clínico completo | — | ✓ | — | — |
| Registrar/editar Datos por consulta | — | ✓ | — | — |
| Consultar gráficas de crecimiento | — | ✓ | — | — |
| Consultar/editar vacunas | — | ✓ | — | — |
| Consultar recomendaciones/receta | — | ✓ | — | Limitado: todos los documentos vigentes de sus niños autorizados; sin clínica privada completa |
| Imprimir documentos | — | ✓ | — | Limitado: contenido visible sin logo |
| Configurar impresión y logo | — | ✓ | — | — |
| Ver notificaciones | — | ✓ | ✓ | — |
| Ver perfil propio | ✓ | ✓ | ✓ | Limitado: correo y nombres de pacientes asociados, lectura |
| Editar perfil propio desde UI | Limitado: solo correo¹ | ✓, correo fijo | ✓, nombre/correo¹ | — |
| Cambiar correo propio desde perfil | ✓¹ | — | ✓¹ | — |
| Cerrar sesión | ✓ | ✓ | ✓ | ✓ |

Notas: la primera cuenta Admin se prepara externamente; las siguientes se invitan desde Administradores. Desde Perfil, Admin cambia únicamente correo; Asistente cambia nombre/correo; Doctor mantiene correo propio fijo. ¹Invitación, edición administrativa y baja requieren los servicios preparados, deshabilitados hasta activación/prueba integrada. Cambiar correo propio vuelve al login con contraseña actual; editar a otra persona conserva sesión del operador. Reagendar conserva el paciente y utiliza las mismas validaciones en desktop/mobile.

## Reglas compartidas de citas

**CONFIRMADO:** primero se toma el día semanal y sus segmentos; se generan horas sucesivas según duración. Solo se ofrecen consultas que caben completas en el segmento. Un Fin de 00:00 se trata como final del día. No se permiten días pasados; hoy solo ofrece horas posteriores a la hora actual del centro de México. Un día cerrado no puede elegirse en una nueva reserva. Hoy permanece seleccionable si está abierto, aunque ya no queden horas futuras; seleccionar la fecha no autoriza reservar una hora pasada. Al reagendar se mantiene la excepción de conservar la propia fecha/hora original vigente, descrita en P20. Aplica a Doctor, Asistente y Paciente. Fuentes: `src/app/core/utils/availability.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts` y sus pruebas.

**Semana completamente cerrada (P25):** Doctor o Asistente pueden quitar todos los segmentos y guardar sin días abiertos. La configuración se conserva al reabrir y no ofrece días/horas para nuevas reservas; las citas existentes permanecen. No cambia la autorización del Doctor para que los pacientes agenden: ese permiso y la disponibilidad son condiciones independientes. Añadir un segmento y guardar reabre el día. Fuentes: `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`, `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/p25-closed-week.spec.ts`.

**Validar horarios antes de guardar (P26):** Doctor y Asistente deben completar Inicio/Fin con horas HH:mm y orden válido. Fin 00:00 significa final del día. No se permiten segmentos solapados del mismo día, incluidos duplicados o uno contenido en otro; terminar uno a la hora de inicio del siguiente sí está permitido. La lista de errores señala día/segmento, aunque otro día esté abierto. Corregir o eliminar el segmento permite continuar. Guardar requiere cambios y configuración válida; queda bloqueado durante la petición. Mantiene permitida la semana cerrada y no altera citas existentes. Fuentes: `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`, `settings-dialog.html`, `settings-dialog.spec.ts`.

**Hora del consultorio (P28, CONFIRMADO en código):** la referencia es la hora del centro de México (`America/Mexico_City`), definida por el usuario. Calendario, botón Hoy, indicadores de día/hora actuales, Consultas del día, filtros de reserva, fecha de nueva entrada clínica y vigencia de documentos usan ese día y esa hora aunque el dispositivo esté en otra zona. Las opciones se actualizan al cambiar el minuto o al volver a la página. Un formulario abierto puede perder horarios que ya pasaron; antes de guardar se comprueba nuevamente la disponibilidad. La fecha que el usuario está consultando o eligió para su cita se conserva: cambiar la zona del dispositivo no convierte la reserva a otra fecha/hora. Los campos de nacimiento y las vigencias elegidas conservan su día civil. Fuentes: `src/app/core/utils/clinic-time.ts`, `src/app/core/services/clinic-clock.service.ts`, `src/app/core/utils/availability.ts`, `src/app/pages/calendar/calendar.ts`, `src/app/pages/patients/patients.ts`, `src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts`, `src/app/pages/patient-history-view/patient-history-view.ts`.

**Agenda móvil vacía (P27, CONFIRMADO):** «No tienes consultas agendadas para este día.» se refiere al día seleccionado, tanto hoy como otra fecha. Fuente: `src/app/pages/calendar/calendar.html`.

El personal puede reservar una hora ya ocupada y recibe advertencia de superposición. El Paciente selecciona horas libres. La reserva del portal se registra directamente, sin un paso posterior de aprobación del Doctor.

Reagendar mantiene fijo el paciente. Reservar desde el historial también fija el paciente; desde el calendario permite elegirlo. Crear un nuevo paciente dentro de una reserva regresa al formulario y lo selecciona, pero todavía hay que confirmar la cita. Cancelar no agenda automáticamente una sustitución.

**Actualización local P18:** en mobile, tarjeta de consulta → detalle → Reagendar cierra el detalle y abre el formulario precargado en un panel inferior. Doctor y Asistente usan su agenda autorizada; Paciente necesita que el Doctor permita reservas. X conserva la cita existente sin cambios. **CONFIRMADO** por conexión del template y pruebas de interacción para los tres roles. Fuentes: `src/app/pages/calendar/calendar.html`, `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/calendar.spec.ts`.

**Actualización local P19:** las citas canceladas y deshabilitadas no ocupan horarios. Al recibir la cancelación, el calendario y el formulario abierto del Paciente actualizan las horas disponibles. Si otra cita vigente comparte fecha/hora, esa hora continúa ocupada para el portal; los límites de fecha, segmentos y permiso de reservas siguen aplicando. Las canceladas no generan advertencia de superposición al personal.

**Actualización local P20 — CONFIRMADO:** al reagendar en el portal del Paciente, se excluye únicamente la cita editada del cálculo de ocupación, al abrir y al recibir cambios. Permite conservar fecha/hora y modificar solo motivo; otra cita vigente, incluida otra de la familia, sigue bloqueando esa hora. El calendario sigue mostrando la reserva como ocupada para crear una cita nueva. Doctor y Asistente conservan su comportamiento de superposición con advertencia. Guardar solo motivo actualiza la misma cita y no genera aviso de cambio de fecha/hora. Fuentes: `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/calendar.spec.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/p20-diagnostic.spec.ts`.

**Disponibilidad de nueva reserva/cambio de horario — CONFIRMADO:** los tres roles conservan Hora al cambiar Día solo si sigue válida en la nueva fecha; de otro modo limpia Hora sin cambiar paciente/motivo. Guardar recalcula opciones. Una fecha/hora nueva rechaza pasado/cerrado/fuera de segmentos/no alineada/no cabe/pasada hoy. **Excepción al editar:** exactamente la fecha/hora original puede conservarse para cambiar solo motivo, incluso fuera del horario actual o en una cita pasada; otra cita vigente sigue bloqueando al Paciente. Reservas deshabilitadas no se habilitan por esta excepción. Personal conserva advertencia de superposición. Hora inválida: «Selecciona una hora disponible dentro del horario del doctor para el día elegido.». Fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, `appointment-dialog.spec.ts`, `p20-diagnostic.spec.ts`.

Fuentes revisadas: [disponibilidad](src/app/core/utils/availability.ts), [reserva](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [calendario](src/app/pages/calendar/calendar.ts).

## Confirmaciones compartidas al añadir pacientes

**CONFIRMADO en P23:** Doctor desde Pacientes o Agendar y Asistente desde Agendar utilizan las mismas confirmaciones. Compartir correo principal/secundario con otro paciente del mismo Doctor muestra un aviso de asociación familiar; Continuar lo acepta. Si coincide además el nombre completo, se muestra un segundo aviso que debe aceptarse de forma independiente. El último Continuar guarda automáticamente y regresa al destino del alta. No prohíbe hermanos ni nombres iguales después de confirmación.

Cambiar nombre o cualquiera de los correos invalida la aceptación y requiere comprobar de nuevo con Añadir paciente. El formulario exige campos válidos; guardar se deshabilita sin cambios, con errores, durante la petición o ante un aviso pendiente. Los errores de guardado se muestran separados de estos avisos y no tienen Continuar. Una petición en curso bloquea otra pulsación de guardar/continuar. El Paciente no tiene acceso a altas. La presentación desktop/mobile conserva este flujo dentro del panel existente. Fuentes: `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts`, `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.html`, pruebas del mismo componente.

## Reglas compartidas de avisos y lectura

- Avisos de consulta agendada, cancelada y reagendada; no se encontró recordatorio previo automático ni push del sistema operativo.
- El contador representa avisos sin leer del destinatario, no solo los elementos ya cargados en la lista.
- Abrir, cambiar filtro o hacer scroll no marca todo como leído.
- Ver detalles marca ese aviso y lleva a la cita del Calendario.
- La acción Marcar todas como leídas cambia todas sin confirmación previa.
- Al cerrar o abandonar la vista de notificaciones se marcan los avisos de cancelación como leídos.
- Las acciones propias comienzan leídas para el actor; los demás destinatarios comienzan sin leer. Doctor y Asistentes reciben avisos de su agenda; la familia autorizada corresponde al mismo Doctor; Admin no recibe avisos de citas.
- Los avisos de campana son distintos de los correos de invitación o de entrega de acceso.

Fuentes revisadas: [vista de avisos](src/app/shared/components/notifications-dialog/notifications-dialog.ts), [servicio de avisos](src/app/core/services/notification.service.ts).

## SCREENSHOTS RECOMENDADOS PARA EL MANUAL

- [ ] Datos ficticios para los cuatro roles en la misma versión habilitada del entorno.
- [ ] Entrega de acceso principal/secundario, parcial y reintento, sin contraseñas/enlaces vigentes.
- [ ] Alertas de éxito/error, confirmación de baja y controles bloqueados durante guardado; desktop/mobile.

- [ ] Diferencia Crear invitación / Reenviar invitación / Reintentar envío, desktop/mobile y datos ficticios.
- [ ] Registro rechazado por enlace caducado/usado/reemplazado; nunca capturar credenciales vigentes.

- [ ] Login de personal y Acceso paciente, cada uno con desktop/mobile.
- [ ] Mensaje de validación de campo y alerta temporal sin datos personales.
- [ ] Navegación Doctor desktop y barra inferior mobile.
- [ ] Navegación Paciente desktop y barra inferior mobile.
- [ ] Admin: Doctores/Administradores/Bitácora en sidebar desktop y barra inferior mobile; campana ausente.
- [ ] Asistente: encabezado sin navegación principal; excepción de asociación no válida con Reintentar/Cerrar sesión.
- [ ] Directorio administrativo, invitación de Admin y edición ajena, con tarjeta propia deshabilitada; desktop/mobile.
- [ ] Baja de Admin con advertencia y restricción de otro Admin activo; datos ficticios.
- [ ] Bitácora en desktop/mobile con registros ficticios y desplazamiento horizontal.
- [ ] Panel derecho de formulario y su variante inferior mobile.
- [ ] Reagendar con datos precargados y paciente fijo: desktop/mobile; Paciente sin permiso con acción oculta.
- [ ] Confirmación de cancelación y de eliminación usando datos ficticios.
- [ ] Datepicker con días bloqueados y lista de horas válidas.
- [ ] Semana completamente cerrada guardada y reabierta; formulario sin días/horas disponibles. Desktop/mobile.
- [ ] Validación de horarios con día/segmento identificado, incluyendo otro día no seleccionado; desktop/mobile.
- [ ] Buscar paciente: selección, edición del texto, mensaje de elegir resultado y Agendar bloqueado; desktop/mobile.
- [ ] Cambiar a un día con otro horario: Hora vacía, validación de selección y opciones nuevas; desktop/mobile.
- [ ] Alta con correo compartido y nombre coincidente: dos avisos y confirmaciones; error de guardado separado. Desktop/mobile con datos ficticios.
- [ ] Notificaciones con Todos/Sin leer, badge y acción de lectura masiva; desktop/mobile del personal.
- [ ] Estado de error/empty state que no pueda confundirse con una operación exitosa.

## INFORMACIÓN QUE NO PUDE CONFIRMAR DESDE EL CÓDIGO

1. ¿Qué versión desplegada y URL servirán como referencia de los manuales?
2. ¿Quién prepara la primera cuenta Admin y qué canal autorizado entrega las invitaciones siguientes cuando el correo falla?
3. ¿Qué canal de soporte del consultorio debe indicarse a cada rol?
4. ¿Qué navegadores, dispositivos e impresión/PDF están oficialmente soportados?
5. ¿Qué política de conservación y recuperación de expedientes debe comunicarse?
6. ¿Qué datos ficticios se utilizarán en los screenshots?
