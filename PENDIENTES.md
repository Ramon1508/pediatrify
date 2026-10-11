# Pendientes de verificación — Lilcare

Registro separado de irregularidades, inconsistencias y decisiones que requieren revisión antes de preparar los manuales oficiales. Estas observaciones no forman parte de las instrucciones de uso de los cinco contextos funcionales.

Fecha de investigación: 4 de octubre de 2026. Referencia inicial de código: 76791ac. Auditoría inicial estática; posteriormente se consultaron metadatos y reglas desplegadas para P01, sin leer datos de negocio ni ejecutar casos funcionales reales. Las modificaciones posteriores autorizadas se registran por punto. Los estados siguientes distinguen evidencia de código de resultados que aún deben probarse.

- **CONFIRMADO:** la condición se verifica en el código. No implica que se haya reproducido en una sesión real.
- **POSIBLE / REQUIERE INVESTIGACIÓN:** hay evidencia de un efecto potencial, pero faltan una reproducción o datos del entorno.
- **REQUIERE DECISIÓN DE PRODUCTO:** el comportamiento existe, pero el repositorio no permite saber si corresponde a la política deseada.
- **DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN:** decisión confirmada por el usuario y aplicada localmente; no implica despliegue ni verificación de las reglas de producción.
- **CONFIRMADO EN PRODUCCIÓN / PREPARACIÓN LOCAL:** condición verificada en la configuración desplegada y propuesta preparada por separado; todavía sin integración/despliegue correctivo.

Usar cuentas y datos ficticios para las verificaciones. No pegar contraseñas, enlaces de acceso vigentes, documentos médicos reales ni configuración sensible en este archivo. Los cierres P02–P45 no certifican el ambiente desplegado. **Actualización vigente del 10 de octubre: P01/D10 implementados, publicados y activados en la ventana expresamente autorizada.** Se verificaron 22 Functions ACTIVE y cuatro parámetros habilitados, reglas efectivas idénticas, 16 índices READY, cinco cuentas/UID conservados y Hosting final con el artefacto exacto. La sesión del Paciente es solo de servidor/memoria, sin Firebase Authentication ni persistencia del navegador. P47/P46 completos. **Cierre posterior confirmado por el usuario: D09, seguimiento de notificaciones y P37/D11 cerrados; no quedan puntos abiertos de este registro.** Los apartados anteriores sobre publicación, fase en curso o validación pendiente conservan historia y no sustituyen los cierres vigentes.

### Decisión de alcance — datos antiguos

El 8 de octubre de 2026 el usuario indicó que los datos antiguos no importan y que el Doctor comenzará a capturar información por primera vez próximamente. **No se requiere migrar, reasignar ni recuperar registros antiguos para este trabajo.** Se mantienen las comprobaciones de propietario para los nuevos registros. Esta indicación no autoriza borrar datos existentes ni confirma mediante inspección que la base esté vacía. Cliente, autoridad y backend P01 fueron activados en D10 sin migrar datos antiguos.

### Contexto de dominio — varios expedientes por Doctor

Un mismo tutor/paciente puede tener **varios expedientes, uno por cada Doctor**, aunque compartan el mismo correo de acceso; **cada expediente tiene su propia contraseña**, actualmente privada en servidor (`otpPassword` es un campo legado del modelo), por lo que compartir correo **no** implica un único registro. En consecuencia, la agrupación familiar visible en el portal y los destinatarios de avisos se **acotan por Doctor** (ver P40), y cada expediente se autentica con su propia contraseña.

## Decisiones consolidadas — respuestas confirmadas el 9 de octubre de 2026

Este bloque es el índice vigente para continuar **un punto completo por vez**. El usuario respondió las once preguntas: `D01 A, D02 A, D03 A, D04 A, D05 B, D06 B, D07 A, D08 B, D09 A con omisión temporal de pruebas externas, D10 B, D11 A`. Las recomendaciones y tablas anteriores son historial; estas respuestas prevalecen. **Decisión confirmada no significa implementación terminada ni despliegue realizado.**

### Decisiones ya confirmadas; no volver a preguntar

| Tema | Decisión vigente |
| --- | --- |
| Contraseñas de pacientes | Solo generadas por el sistema; únicas entre las contraseñas activas de todos los pacientes. Se permite reutilizar un código retirado (D01 A). Doctor puede consultar, copiar y regenerar; se retira la edición manual. Reutilizables, sin caducidad hasta renovación. |
| Acceso del Paciente — decisión posterior vigente | Correo + código reutilizable, **sin ninguna cuenta/identidad Firebase Authentication de Paciente**. Acceso y datos únicamente por servidor. Sesión solo en memoria del servicio: no cookies/localStorage/sessionStorage; recargar/cerrar pestaña requiere ingresar de nuevo. Máximo una hora inactiva. El usuario admite alternativamente sessionStorage solo cifrado, pero se eligió memoria; no se implementa persistencia ni se guardan claves de cifrado en navegador. Sustituye la propuesta anterior de token Firebase por dispositivo y restauración del Paciente al recargar. El personal conserva su acceso vigente. |
| Correspondencia del personal — revisión D10 posterior | Conservar documentos, cuentas, contraseñas y asociaciones. Normalizar solo `uid` del Doctor revisado al ID de su documento; adaptar validación de **IDs de personal** para aceptar los identificadores existentes con punto/@/+, sin migrar datos ni usar correo como fuente de autoridad. Mantener estrictos IDs de operación, pacientes, citas, sesiones y Firebase Auth. Corrección remota únicamente durante la activación revisada. |
| Alta realizada por Asistente | No mostrar ni devolver la contraseña al Asistente. Enviar el acceso al tutor; consulta/renovación posterior exclusivas del Doctor propietario. |
| Reserva del Paciente deshabilitada | El Paciente tampoco puede cancelar; solicita la cancelación al consultorio. |
| Disponibilidad por Asistente | Puede modificar días, segmentos y duración; no ve ni cambia «Permitir que los pacientes agenden citas». |
| Perfil propio | Admin: solo correo. Asistente: nombre y correo. Doctor: datos profesionales, con correo propio fijo. |
| Administración | Admin gestiona Doctores y Administradores; orden Doctores → Administradores → Bitácora, entrada Doctores. Solo Admin crea Doctor/Admin; Admin o Doctor pueden crear Asistente en backend. Asistente creado por Admin queda asociado a ese Admin para pruebas, sin agenda hasta vincularse a un Doctor válido. Bloquear baja propia y del último Admin. |
| Sesiones de los cuatro roles | Una hora máxima de inactividad para Paciente, Doctor, Asistente y Administrador (D05 B). Paciente sale a Acceso paciente; el personal conserva su login correspondiente. La contraseña no caduca por inactividad. Esta respuesta amplía el alcance original de P17. |
| Citas y horarios | Canceladas liberan horario; reagenda no cuenta la cita propia, otra vigente sí. Se admite toda la semana cerrada. No reabrir P22 ni agregar reservas atómicas de citas. Hora del consultorio: centro de México. |
| Publicaciones clínicas | Todos los documentos publicados y vigentes accesibles, incluidos dos del mismo tipo y día. Orden por creación original; editar uno anterior no lo promueve. |
| Datos antiguos y cuentas del personal | No migrar ni recuperar datos de negocio anteriores ni borrarlos. Conservar cuentas/UID y accesos actuales del personal, preparando autoridad con herramienta confiable y revisión previa (D04 A). |
| Presentación y documentación | HTML con signals/computed, conservando eventos y referencias de formularios. No redactar aún manuales finales ni capturar screenshots; irregularidades en este archivo. |

### Respuestas vigentes; no volver a preguntar

Todas las opciones D01–D11 tienen respuesta. La implementación y activación autorizadas finalizaron en D10; el cierre al final conserva la evidencia por componente. Posteriormente, el usuario informó que los correos funcionan correctamente, aceptó conservar las notificaciones actuales y comunicó la confirmación del Doctor sobre curvas de crecimiento y esquema de vacunación. D09 y P37/D11 quedan cerrados por esas confirmaciones; no se presentan como nuevas pruebas ejecutadas por el agente.

| ID / punto | Respuesta confirmada | Aplicación / estado |
| --- | --- | --- |
| **D01 / P01 — A** | Unicidad global **solo entre contraseñas activas**. Un código retirado puede volver a utilizarse. | Conservar reserva privada transaccional mientras esté activo; liberarla al renovar/eliminar coherentemente la credencial. No agregar prohibición histórica de reutilización. Generación exclusiva del sistema y contraseña reutilizable hasta renovación se mantienen. |
| **D02 / P01 — A** | Enviar acceso al correo principal **y** secundario, sin duplicar cuando coinciden. | Implementado, probado localmente y activado mediante D10: destinos del servidor, resultado por destinatario, fallo parcial y reintento solo pendiente. Ensayo con SMTP real omitido por D09. |
| **D03 / P01 — A** | El Asistente puede reintentar el envío **solo de esa alta** y sus destinatarios guardados, sin ver la contraseña. | Integrado/probado localmente: conserva operación y paciente, no regenera ni devuelve contraseña; exige alta original y revisión inicial. Consulta/renovación generales exclusivas del Doctor. |
| **D04 / P01 — A** | Conservar cuentas/UID y accesos actuales del personal. | Herramienta confiable preparada: reporte privado, revisión de filas, huellas frescas y Admin operacional requerido. No autoasigna rol por navegador ni crea/baja Auth. D10: cinco correspondencias revisadas/aplicadas/verificadas; cuentas y UIDs conservados, sin migrar clínica antigua. |
| **D05 / P01–P17 — B** | Una hora máxima de inactividad para **los cuatro roles**. | Implementada, probada localmente y activada mediante D10: recarga/suspensión/reanudación, logout Paciente a Acceso paciente, personal a Login; contraseña no expira. |
| **D06 / P01–P33 — B** | Logo personalizado **público por enlace**, sin exigir sesión para verlo. | Reglas Storage probadas y publicadas en D10, con contenido efectivo comparado: get público, no listado, escritura/baja solo Doctor propietario con sesión vigente; PNG/JPEG/SVG no vacío hasta 1 MiB. Herencia/fallback conservados. |
| **D07 / P01–P50 — A** | Reporte para revisión y **limpieza manual** de imágenes sin uso. | Herramienta preparada: comprueba representaciones conocidas, reporte privado y aplicación revisada con escritores detenidos, referencia fresca y generación. Sin cron ni borrados reales. |
| **D08 / P01 — B** | Retención de **30 días** para registros técnicos de sesiones invalidadas y operaciones finalizadas que ya no se requieren para recuperarlas. | Herramienta selectiva preparada/pruebas locales: elimina solo técnicos elegibles y compacta barreras; conserva clínica, bitácora, credenciales/reservas vigentes y marcadores de repetición. Sesiones serverOnly del Paciente solo en almacenamiento privado; compatibilidad histórica Auth separada, jamás personal. Sin TTL indiscriminado ni limpieza real ejecutada. |
| **D09 / comprobación de cierres — CERRADO POR CONFIRMACIÓN DEL USUARIO** | El usuario confirma que los correos funcionan correctamente y pide no continuar ese pendiente. | Ensayo externo del agente omitido; cierre por aceptación y experiencia informadas por el usuario. No crear otro proyecto ni ejecutar pruebas adicionales de cuentas/correos para este cierre. No registrar un ensayo inexistente como aprobado. |
| **D10 / cierre y activaciones — B** | El alcance incluye que el agente prepare y realice publicación y verificación del entorno. | COMPLETADO: revisión concreta, autorización de ventana, publicación conjunta y verificación por componente. Cinco cuentas conservadas; servidor, reglas, índices y Hosting verificados. Ensayo externo omitido por D09, sin declararlo aprobado. |
| **D11 / P37 — CERRADO POR CONFIRMACIÓN DEL DOCTOR, COMUNICADA POR EL USUARIO** | El usuario informa que el Doctor confirma las curvas de crecimiento y el esquema de vacunación actuales. | Mantener la implementación. Fuente de cierre: confirmación del usuario del 10 de octubre de 2026, no certificación clínica del agente. No se indicó una referencia bibliográfica concreta; no inventarla ni mantener el punto abierto por esa ausencia. |

**Alcance confirmado:** D01–D08 fijan comportamiento/transición/mantenimiento; D09 omite por ahora el ensayo externo y conserva el entorno separado para cuando se necesite; D10 incluye publicación; D11 define al responsable clínico. Los 30 días son política operativa elegida, no una afirmación legal. No se han provisionado secretos, cambiado cuentas, borrado recursos ni publicado cambios al registrar estas respuestas.

### Estado vigente del trabajo autorizado tras D10

| Punto | Estado actual | Trabajo restante / criterio de cierre |
| --- | --- | --- |
| **P01** | **IMPLEMENTADO / PUBLICADO / ACTIVADO** | D10 completado y verificado por componente; Paciente sin Firebase Auth, sesión en memoria. Ensayo externo omitido según D09. Detalle en `security/p01/AVANCE_INTEGRACION.md`. |
| **P04/P05/P09/P10/P13/P45** | Implementados, comprobados localmente y activados con P01 | Servicios publicados y parámetros habilitados en D10. No se ejecutaron bajas, cambios de correo ni invitaciones con cuentas reales como ensayo externo; omisión D09 conservada. |
| **P46** | **RESUELTO; documentación sincronizada tras D10** | Cinco contextos funcionales y PROJECT actualizados con decisiones y estado publicado, listas de capturas y preguntas externas. Se comprobaron 373 referencias locales en seis documentos; no manuales finales ni screenshots. |
| **P47** | **RESUELTO / PUBLICADO** | 46 HTML externos, cinco templates inline y dos host bindings sin infracciones. Signals/computed conservando handlers/formularios; última suite Angular 886/886 y build producción aprobados. Artefacto publicado en D10. |
| **P48–P52** | Resueltos y publicados con D10 | Regresiones locales conservadas. Ensayo visual/funcional externo no realizado según D09; no reabrir decisiones ya tomadas. |
| **P37** | **CERRADO POR CONFIRMACIÓN DEL DOCTOR COMUNICADA POR EL USUARIO** | Curvas de crecimiento y esquema de vacunación confirmados; conservar comportamiento. No requiere cambio de código ni nueva decisión. |

**Restante vigente: ninguno en la lista actual.** P37/D11 y D09 cerrados por las confirmaciones posteriores del usuario. Seguimiento de notificaciones cerrado por aceptación de su funcionamiento actual, sin cambio ni nueva prueba de carga. D07/D08 son tareas periódicas manuales con herramientas preparadas, no implementación pendiente ni autorización de borrado indiscriminado. P01, sus activaciones dependientes, P47, P46 y D10 están completados. Los apartados cronológicos anteriores conservan historia y no sustituyen este estado.

Fuentes revisadas para este índice: historial de decisiones de este archivo; `security/p01/AVANCE_INTEGRACION.md`; `security/p01/INTEGRACION_CREDENCIALES.md`; `functions/src/clinic-auth.ts`; `functions/src/patient-credentials.ts`; `functions/src/clinic-patients.ts`; `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts`; `src/app/pages/patients/patients.ts`; `src/app/shared/components/file-upload/file-upload.ts`.

## Acceso, roles y eliminación

| ID | Estado | Observación / efecto | Qué verificar | Fuentes |
|---|---|---|---|---|
| P01 | PUBLICADO / ACTIVADO / VERIFICADO POR COMPONENTE | D10 completo: reglas efectivas comparadas, indices listos, servidor y cliente compatibles, cuentas del personal conservadas, Paciente sin Firebase Auth. | Ensayo externo omitido por D09; evidencia clinica D11/P37 independiente. Consultar cierre vigente al final. | [activacion](security/p01/ACTIVACION_COORDINADA.md), [avance](security/p01/AVANCE_INTEGRACION.md), [auditoria](security/p01/audit-integration.json) |
| P02 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: la vista de impresión por enlace es exclusiva del Doctor propietario del paciente. La ruta excluye Administrador, Asistente y Paciente; la vista valida `patient.doctorId` antes de mostrar contenido y bloquea expedientes sin propietario. El autor del registro no sustituye esa pertenencia. Se conserva la impresión del portal del Paciente. | Cambio local autorizado el 8 de octubre de 2026: 40 pruebas aprobadas y compilación de desarrollo correcta. Falta validación tras despliegue. Esta protección de interfaz no impide lecturas directas de Firestore: la aplicación sigue obteniendo registro/paciente para comprobar pertenencia; la protección de esos datos requiere integrar P01. | [rutas](src/app/app.routes.ts), [rol](src/app/core/guards/role.guard.ts), [vista](src/app/pages/print-preview/print-preview.ts), [pruebas](src/app/pages/print-preview/print-preview.spec.ts) |
| P03 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: aislamiento por Doctor. Calendario, reserva desde historial, refresco de alta embebida, listado y sugerencias de pacientes en perfiles consultan por `doctorId`; excluyen pacientes ajenos y sin propietario. El Asistente utiliza el Doctor asignado, sin sustituirlo por su propia identidad. La reserva comprueba el alcance antes de guardar. | Verificar tras despliegue con cuentas sintéticas de dos doctores y un asistente. Los datos antiguos quedan fuera de alcance por decisión del usuario; no hay tarea pendiente de migrarlos/reasignarlos ni se borraron. La protección de solicitudes directas sigue en P01. Validaciones locales detalladas abajo. | [consulta/listener](src/app/core/repositories/patient.repository.ts), [calendario](src/app/pages/calendar/calendar.ts), [listado](src/app/pages/patients/patients.ts), [reserva](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [historial](src/app/pages/patient-history/patient-history.ts) |
| P04 | DECIDIDO / IMPLEMENTADO LOCALMENTE; ACTIVACIÓN PENDIENTE | Opción 1: baja definitiva de Auth y revocación de sesiones. El navegador delega en servidor, sin cascada alternativa local; el endpoint verifica identidad, rol y propiedad, bloquea acceso antes de borrar y conserva metadatos para reintentos. Está deshabilitado por defecto hasta integrar P01. | Pasaron 48 pruebas backend y 24 de aplicación, compilación Functions/Angular de desarrollo y lint sin errores. Falta protección/provisión de principales, coordinación de escritores y del portal de P01, pruebas integradas y despliegue. No se eliminaron cuentas reales. | [alcance y activación](security/p04/IMPLEMENTACION_Y_ACTIVACION.md), [endpoint](functions/src/staff-deletion.ts), [confirmación](src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.ts) |
| P05 | DECIDIDO / IMPLEMENTADO LOCALMENTE; ACTIVACIÓN PENDIENTE | Opción 1: la baja del Doctor incluye sus Asistentes vinculados, accesos, bandejas, avisos de citas eliminadas y logos de sus prefijos privados. Horarios/impresión desaparecen con el perfil. Bloquea todos los accesos antes de borrar recursos y recupera operaciones secundarias al reintentar. | 61 pruebas backend y 24 de aplicación aprobadas; Functions/Angular de desarrollo y lint sin errores. Activación depende de P01: autoridad protegida, coordinación de altas/avisos/uploads y portal, permisos Storage y pruebas integradas. Sin despliegue ni datos/cuentas reales. | [alcance y límites](security/p05/IMPLEMENTACION_Y_VERIFICACION.md), [cascada](functions/src/staff-deletion.ts), [confirmación](src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.ts) |
| P06 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: bloqueo del calendario y aviso con Reintentar/Cerrar sesión si el Asistente no tiene Doctor válido. Complementa P03/P05: valida antes de cargar pacientes/citas; retira datos y cierra paneles si el Doctor deja de ser válido. Reintentar relee el perfil del Asistente y su asociación; no ofrece reasignación. Presentación nueva con signals. | 67 pruebas aprobadas en cuatro archivos y compilación de desarrollo correcta. Falta comprobación visual tras despliegue con cuentas sintéticas, y protección de backend de P01. No reemplaza revocación de Auth ni detiene solicitudes ya enviadas. | [calendario](src/app/pages/calendar/calendar.ts), [aviso](src/app/pages/calendar/calendar.html), [pruebas](src/app/pages/calendar/calendar-association.spec.ts), [listener](src/app/core/repositories/user.repository.ts) |
| P07 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | El usuario confirmó que el Asistente puede cambiar días, segmentos y duración, pero no permitir/deshabilitar reservas del Paciente. El interruptor solo aparece al Doctor; el control del Asistente queda deshabilitado y su guardado omite ese campo, incluso si se altera el formulario. | Cambio local autorizado el 4 de octubre de 2026. Pasaron 35 pruebas de configuración/calendario y la compilación de desarrollo. La compilación de producción no terminó por un fallo al descargar fuentes de Google. Falta comprobarlo tras despliegue; la protección de datos en reglas se revisa separadamente en P01. | [interfaz](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.html), [guardado](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts), [pruebas](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.spec.ts) |
| P08 | DECISIÓN REVISADA / IMPLEMENTACIÓN LOCAL | Admin: correo propio únicamente; Asistente: nombre/correo propios; Doctor: perfil profesional y correo fijo. Correo conectado a P09/P10 todavía deshabilitado. | Validar interfaz por rol y activar servicio coordinado con P01. | [perfil](src/app/shared/components/profile-dialog/profile-dialog.ts), [política candidata](security/p01/policy.mjs) |

### P01 — Opciones para la revisión

El usuario eligió **opción 1**. Se completaron la inspección remota y la preparación aislada de un prototipo; no se han sustituido las reglas/configuración de producción ni desplegado cambios. La integración enumerada en la propuesta sigue pendiente para poder cerrar P01.

1. **Verificar y preparar protección completa (recomendada):** contrastar las reglas del repositorio con las efectivas, definir acceso por rol, Doctor y familia, y preparar la corrección con pruebas de acceso permitido/denegado antes de un despliegue.
2. **Solo verificar el entorno:** comprobar las reglas desplegadas e informar del alcance real; mantener la corrección pendiente.
3. **Posponer:** conservar P01 abierto y continuar con el siguiente punto.

La revisión debe contemplar el acceso del Paciente: actualmente no inicia una sesión de Firebase Authentication. Exigir indiscriminadamente esa sesión puede interrumpir su portal; una solución completa debe proteger también este acceso. Fuente: [acceso del Paciente](src/app/core/services/auth.service.ts).

Resultado de preparación: permisos basados en autoridad confiable, separación de datos mínimos/clínicos, login del Paciente validado en servidor con token personalizado, notificaciones por destinatario y revocación de sesiones. Los módulos preparados se ejecutan en pruebas pero aún no son endpoints integrados con la aplicación. La propuesta distingue validaciones candidatas de comportamiento actual; la auditoría de producción y la del prototipo se conservan por separado en `security/p01`.

Verificación final: **79 pruebas aprobadas** (42 de reglas en Firestore Emulator y 37 de permisos/acceso), sin fallos ni omitidas. El emulador utiliza un proyecto demo aislado; no se leen o modifican datos de negocio reales. **P01 conserva estado abierto** hasta terminar integración, validación de los flujos nuevos y despliegue coordinado. La migración de registros antiguos dejó de ser un requisito por decisión del usuario.

### P02 — Decisión y alcance aplicado

El usuario eligió **opción 1**: reservar `/print/:recordId` al Doctor propietario. Implementación local del 8 de octubre de 2026:

- La ruta exige sesión y rol Doctor. Administrador, Asistente y Paciente son redirigidos al login por el guard de rol existente.
- La vista comprueba de nuevo el rol antes de consultar datos; compara el Doctor de la sesión con `patient.doctorId` antes de publicar datos en pantalla, cargar los ajustes y preparar la impresión. Un registro cuyo autor coincide con el Doctor no concede acceso a un paciente ajeno o sin propietario.
- Los campos de presentación de registro, paciente, Doctor, edad, fecha y permiso de visualización utilizan signals/computed; la plantilla no añade llamadas a funciones de formato ni getters.
- Cambiar de cuenta/rol o cerrar sesión retira el contenido de la vista y bloquea la apertura de impresión. Destruir la vista cancela la apertura automática pendiente. Esto no puede retirar documentos ya impresos o ventanas ya abiertas.
- Registros inexistentes, pacientes inexistentes/sin propietario y acceso fuera del alcance muestran «El registro no está disponible para esta cuenta.», sin detallar si el documento existe. Una lectura fallida muestra «No fue posible cargar la impresión. Intenta abrirla nuevamente.»; ambos casos terminan el estado de carga.
- La vigencia de publicación para Paciente no limita la impresión por el Doctor propietario. La impresión de recetas/recomendaciones desde el portal del Paciente conserva su implementación y controles visibles actuales.
- **40 pruebas aprobadas:** 27 de vista/acceso de impresión, 5 de guards y 8 del diálogo clínico. Incluyen roles excluidos, pertenencia, autor coincidente sin pertenencia, ausencia de datos, errores de lectura, cambio de sesión, retirada del contenido del DOM y destrucción antes de impresión. La compilación de desarrollo pasó. No se hicieron pruebas con documentos reales ni despliegues.

**Límite pendiente en P01:** se trata de control en la aplicación. El registro clínico y el paciente se consultan antes de verificar pertenencia; las reglas abiertas no impiden solicitudes directas fuera de esta pantalla. P02 no se presenta como protección de confidencialidad completa hasta integrar la protección de backend de P01.

### P03 — Decisión y alcance aplicado

El usuario eligió **opción 1**: seleccionar/listar únicamente pacientes del Doctor correspondiente y mantener los expedientes antiguos sin propietario fuera de los listados habituales. Implementación local del 8 de octubre de 2026:

- El calendario consulta pacientes por Doctor; para un Asistente utiliza `createdBy`, sin alternativa a su UID. La página Pacientes usa un listener por Doctor y lo registra para cerrar la suscripción al salir. Ninguno de estos dos flujos lee el padrón global.
- Agendar desde historial carga el padrón del Doctor y comprueba que incluya al paciente de ese perfil antes de abrir el formulario.
- El diálogo de cita filtra los pacientes recibidos, valida que la agenda corresponda al Doctor/Asistente/Paciente de la sesión y verifica pertenencia antes de crear o reagendar. No permite trasladar una cita cuyo Doctor guardado es diferente al de la agenda.
- Tras crear un paciente dentro de la cita se vuelve a consultar únicamente el Doctor de esa agenda. Al cerrar el diálogo, incluso sin confirmar la cita, se refresca el padrón del calendario: el paciente puede haberse guardado antes de cancelar la reserva.
- Las sugerencias «Quién lo recomendó» al editar/completar perfil también consultan y muestran únicamente pacientes de ese Doctor.
- El padrón del calendario y los listados de sugerencias afectados usan signals; las plantillas afectadas leen estas señales. No se añadieron funciones de presentación al HTML.
- La ausencia de Doctor asociado impide al Asistente crear pacientes bajo su propia identidad. El aviso y bloqueo se completaron posteriormente en P06, sin pantalla de reasignación. No se modificó la cuenta de ningún Asistente ni se consultaron documentos reales.
- Se conserva el grupo familiar suministrado por el portal del Paciente. Los documentos sin `doctorId` o con propietario vacío no se recuperan mediante un alcance vacío. No hubo asignación automática, migración, eliminación ni despliegue.

**Verificación local:** **116 pruebas aprobadas en 8 archivos**, sin fallos. Cubren consultas/listener del repositorio, aislamiento por Doctor y Asistente, exclusión de expedientes ajenos/sin propietario, búsqueda y refresco tras alta, cierre del formulario sin reservar, rechazo de una agenda o cita ajena, reserva desde historial, sugerencias de perfil, creación bajo el Doctor asignado y bloqueo del alta de un Asistente sin asociación. La compilación de desarrollo pasó. Los casos usan datos sintéticos y dependencias simuladas; no prueban cuentas reales ni las reglas desplegadas. Comando de compilación: `node node_modules/@angular/cli/bin/ng.js build --configuration development`; pruebas mediante `ng test --watch=false --include=...` de los ocho archivos correspondientes.

**Límites:** no sustituye las reglas de backend pendientes en P01. Persisten vías generales preparadas/legacy (`Appointments`, sin ruta activa, y `PatientStore.watchAll`, sin consumidor activo identificado), además de otros accesos por documento/colección del alcance de P01. La validación rechaza citas cuyo `doctorId` difiere del Doctor propietario; no se adaptarán citas históricas para admitirlas, por decisión del usuario. Las sesiones reales y el despliegue coordinado siguen pendientes; migrar/reasignar datos antiguos no es requisito.

### P04 — Decisión y alcance aplicado

El usuario eligió **opción 1: baja definitiva**. Se implementó la callable `deleteStaff`, el servicio cliente y la confirmación con signals/computed. Administrador elimina Doctor; Doctor elimina su Asistente. P45 amplía posteriormente la baja a otro Administrador, conservando un Admin operativo; baja propia sigue prohibida. Cuenta Auth y perfil pueden tener IDs distintos; el servidor exige el vínculo confiable de P01, nunca recibe el rol o UID Auth del navegador ni elimina cuentas por un simple correo coincidente.

Primero se deshabilita Auth, se revocan refresh tokens y se desactiva el principal. Después se borran datos asociados y Auth; al completar se elimina el perfil. El borrado puede quedar parcial ante un fallo: no hay éxito ni reversión automática; conserva vínculo y reserva de operación para reintentar. Una baja individual de Asistente no elimina pacientes, registros clínicos ni citas de la agenda del Doctor. La limpieza adicional elegida en P05 se implementó posteriormente sobre esta callable, con la misma activación pendiente de P01.

**Estado:** código local preparado y conectado, sin despliegue. `STAFF_DELETION_ENABLED` tiene valor inicial `false`; no se cambió ningún entorno. **No desplegar únicamente el frontend ni habilitar el endpoint con las reglas abiertas actuales.** La activación requiere autoridad protegida/provisionada y coordinación de escrituras/registro/portal en P01. Revocar refresh tokens no sustituye esas reglas ni fuerza por sí solo el cierre visual inmediato de cada sesión. El prototipo de P01 no está integrado todavía.

**Verificación:** 48 pruebas de backend/política/adaptadores y 24 de aplicación aprobadas; compilación Functions, Angular de desarrollo y lint Functions sin errores. Sin cuentas/datos reales ni pruebas integradas de emuladores. Detalle, límites, orden, concurrencia y condiciones de activación: [P04](security/p04/IMPLEMENTACION_Y_ACTIVACION.md). P04 conserva activación pendiente; no requiere otra decisión de producto para el alcance elegido.

### P05 — Decisión y alcance aplicado

El usuario eligió **opción 1: eliminar Asistentes y recursos propios junto con el Doctor**. Implementación local del 8 de octubre de 2026:

- Se seleccionan Asistentes del Doctor por rol y `createdBy`, se comprueba su identidad protegida y se reserva cada baja. Se recuperan también jobs secundarios de intentos anteriores por `parentUserId`; no se amplía el permiso para que Admin elimine un Asistente individual.
- Se deshabilitan/revocan los accesos del Doctor y todos los Asistentes reservados y se desactivan sus principales antes del borrado de recursos. Si un Asistente no tiene vínculo verificable, la preparación se detiene sin omitirlo ni borrar expedientes.
- Se retiran perfiles/Auth de Asistentes y, para cuentas eliminadas, bandejas actuales (`recipientId`). Se eliminan todas las copias de avisos de una cita borrada antes de eliminarla. No se borran avisos ajenos por el solo hecho de haber sido creados por un Asistente eliminado.
- Se limpian objetos/versiones listables únicamente bajo `logos/{ID del perfil}/`, sin seguir URLs/campos arbitrarios. Los campos de horarios/impresión se eliminan con el perfil. Se conservan otros consultorios, marca estática, bitácora, contadores globales y tombstones de revocación/reintento.
- La confirmación usa signals/computed y explica el alcance según Doctor/Asistente; esto corrige también **P11**. No se modificaron otras decisiones de producto.

**Verificación:** 61 pruebas backend/política/adaptadores y 24 de aplicación aprobadas; compilación Functions, Angular de desarrollo y lint sin errores. Se probaron fallos/reintentos, identidades inválidas, concurrencia, bandejas/copia familiar, aislamiento de logos y conservación de citas del Doctor al eliminar un Asistente. Adaptadores simulados; sin pruebas de reglas/cuentas reales.

**Estado y límites:** sigue deshabilitado por defecto hasta integrar P01. Queda coordinar escritores/registro/avisos/uploads con jobs del Doctor y del Asistente, revocación/proyecciones familiares, permisos/reglas de Storage y prueba integrada. No hubo despliegue ni limpieza de datos históricos. La retención/soft delete del bucket no se puede determinar desde el repositorio; no se promete purga física de copias retenidas. Detalles: [P05](security/p05/IMPLEMENTACION_Y_VERIFICACION.md).

### P06 — Decisión y alcance aplicado

El usuario eligió **opción 1: bloquear y avisar, con Reintentar y Cerrar sesión**, señalando su relación con el escenario ya tratado en P05. Implementación local del 8 de octubre de 2026:

- No repite la cascada de P05. Atiende una asociación ausente, un Doctor inexistente, un destino de otro rol o un Doctor pendiente/con perfil incompleto. Exige que la identidad del documento leído coincida con la agenda asociada. Antes de validar no consulta pacientes/citas ni ofrece Configuración/Agendar.
- Durante la comprobación muestra «Verificando el Doctor asociado…». Si la asociación es inválida muestra «No podemos abrir tu calendario» y «Tu cuenta no tiene un Doctor válido asociado. Contacta al responsable del consultorio.». Un fallo de lectura/listener tiene mensaje diferente y permite reintentar.
- Un listener del Doctor retira agenda, pacientes, detalles y foco si deja de ser válido o falla su lectura. Se cierran los paneles de reserva/configuración y confirmaciones registrados por ese calendario. Se impiden nuevas aperturas, cancelación y deshabilitación desde esa instancia bloqueada.
- Las respuestas tardías de carga, confirmaciones pendientes y temporizadores de foco no vuelven a publicar datos ni lanzan una modificación después del bloqueo. Destruir la vista cierra sus listeners. Un cambio de sesión/asociación conocido por el cliente retira la agenda.
- Reintentar relee el perfil del Asistente, comprueba que siga correspondiendo a esa sesión/rol y actualiza solamente la sesión local antes de verificar nuevamente el Doctor. Puede reconocer una corrección de asociación hecha externamente; **no escribe/reasigna perfiles ni añade una herramienta para elegir Doctor**. La identidad del documento se normaliza también en el listener de usuario; sus errores se propagan al estado de pantalla.
- Cerrar sesión espera el resultado antes de ir al login; ante fallo muestra «No fue posible cerrar sesión. Intenta nuevamente.». Los controles nuevos leen signals/computed; los botones usan eventos, sin funciones de presentación añadidas al HTML. El aviso aparece tanto en desktop como en mobile, con botones de ancho completo hasta 768 px.

**Verificación:** 67 pruebas aprobadas en cuatro archivos (calendario, asociación, listener de usuario y configuración); compilación Angular de desarrollo correcta. Datos sintéticos y servicios simulados: asociación ausente/inválida, perfil pendiente/incompleto, errores y recuperación, corrección externa detectada al reintentar, cierre de panel, invalidación durante carga/confirmación, cambio de cuenta durante reintento y limpieza de suscripciones. Sin sesiones/datos reales ni despliegue.

**Límites:** es control de esta pantalla, no autoridad de backend. P01 sigue pendiente y P04/P05 siguen deshabilitados hasta integrarlo. No puede revocar operaciones ya enviadas, ventanas ajenas al calendario ni copias de datos ya obtenidas. El listener no crea un sistema de reasignación ni vigila continuamente todas las modificaciones del perfil del Asistente; Reintentar relee ese perfil. P06 queda cerrado en implementación local, con validación posterior al despliegue; no requiere otra decisión de producto para el alcance elegido.

### P08 — Definición revisada de edición propia

La decisión anterior (Admin: nombre / Asistente: lectura) quedó sustituida por la indicación más reciente del usuario, confirmada expresamente para Administrador:

- **Administrador:** desde Perfil puede editar únicamente su correo. Nombre propio visible de lectura/deshabilitado; no se envía aunque se manipule el formulario. No edita datos profesionales. P45 incorpora la gestión de nombre/correo de **otros** Administradores en un directorio separado; no modifica esta restricción del perfil propio.
- **Asistente:** puede editar su nombre y correo. Nombre obligatorio, no solo espacios y hasta 300 caracteres; solo se envían los campos permitidos. Sin logo, datos profesionales, rol o Doctor asociado editable.
- **Doctor:** conserva edición de datos profesionales/logo y correo propio de lectura.
- Perfil inicia en lectura. Editar perfil abre el modal en desktop y panel inferior desde la página mobile. Cancelar restaura el borrador. Guardar bloqueado por inválido/intacto/sin cambio permitido/carga; spinner y cierre bloqueado durante solicitud. Presentación y formulario expuestos al HTML mediante signals/computed.
- Nombre solo del Asistente usa la escritura existente y actualiza sesión local sin logout. **Correo propio requiere el servicio de P09/P10**: solo confirma tras sincronizar Auth/perfil y vuelve al login con nuevo correo/contraseña actual. No hay contraseñas nuevas ni creación de otra cuenta.
- Se ajustó únicamente la política candidata aislada: `profile.update` admite nombre propio de Asistente y perfil profesional de Doctor; `profile.email.change` permite correo propio de Admin y nombre/correo de Asistente. Las reglas reales no se modificaron.

**Estado:** implementación local y pruebas sintéticas; la edición de correo está preparada pero no habilitada/desplegada. Permisos completos y adaptación de escritores siguen pendientes de P01.

### P09/P10 — Cambio de correo conservando cuenta

Opción 1 elegida: nombre/correo dentro de un único formulario, sin controles de contraseña. Administrador modifica Doctor; Doctor modifica Asistente propio; Admin cambia correo propio y Asistente nombre/correo propio según P08 revisado.

- Cliente llama `updateStaffEmail`; se retira `createUserWithEmailAndPassword`/logout del operador del editor de terceros.
- Cuenta activa: se conserva Auth UID, contraseña, roles/asociación y referencias de pacientes/citas. Auth y perfil confirman el mismo correo antes de anunciar éxito; el correo nuevo no se presume verificado.
- Invitación pendiente y sin Auth vinculado: solo cambia el perfil; no crea acceso. El mensaje pide reenviar la invitación al nuevo correo.
- Servidor comprueba token con revocación, autoridad/perfil actuales, vínculo UID, propiedad del Asistente, Doctor disponible y ausencia de bajas. Rechaza parámetros de autoridad, duplicados, correo esperado desactualizado y otra operación pendiente.
- Jobs/reservas privados permiten reintentar el mismo contenido, incluso con identificador nuevo al volver a entrar. Los errores parciales conservan metadata y liberan lease; un cambio pendiente bloquea la baja correspondiente. No hay transacción conjunta Auth/Firestore ni rollback automático.
- Inicio/restauración de sesión prefieren Auth UID; login ya no sobrescribe el correo de perfil, para permitir el reintento tras fallo parcial.
- **Propio:** al confirmar se cierra sesión y se navega al login, con aviso de usar nuevo correo y contraseña actual. **Tercero:** el operador mantiene su sesión. Firebase invalida refresh tokens del titular al cambiar correo; no se promete expulsión instantánea de todas sus otras ventanas.
- Gate `STAFF_EMAIL_CHANGE_ENABLED` por defecto false, antes de acceder a datos. No se activa sin autoridad/jobs/reservas protegidos, coordinación de registro/edición/baja y pruebas integradas de P01.

**Verificación:** 68 pruebas específicas de UI/servicio/header; prueba de login/restauración por UID; 562 pruebas aprobadas en el suite Angular completo (53 archivos); 149 pruebas conjuntas de servidor y regresión P01/P04. Build Functions, lint sin errores y build Angular de desarrollo aprobados. Sin cuentas reales, despliegue o cambios de reglas/configuración. Registro detallado en [implementación y activación](security/p09/IMPLEMENTACION_Y_ACTIVACION.md).

## Cuentas, invitaciones y acceso del Paciente

| ID | Estado | Observación / efecto | Qué verificar | Fuentes |
|---|---|---|---|---|
| P09 | IMPLEMENTADO LOCALMENTE / ACTIVACIÓN PENDIENTE | Un solo formulario de nombre/correo; se retiran contraseñas nuevas. Validaciones y presentación signals; cierre/doble envío bloqueados durante guardado. | Validación visual desktop/mobile tras despliegue y servicio integrado. | [editor](src/app/pages/doctors/dialogs/edit-doctor-dialog/edit-doctor-dialog.ts) |
| P10 | IMPLEMENTADO LOCALMENTE / DESHABILITADO HASTA P01 | Cambio en servidor conserva Auth UID/contraseña y sincroniza perfil; propios vuelven a login, operador de terceros mantiene sesión. Reintentos privados y gate por defecto false. | Proteger identidad/jobs/reservas y coordinar escritores antes de habilitar; pruebas Auth/Firestore integradas pendientes. | [servidor](functions/src/staff-email-change.ts), [activación](security/p09/IMPLEMENTACION_Y_ACTIVACION.md) |
| P11 | CORREGIDO LOCALMENTE COMO PARTE DE P05 | Mensaje derivado de signals/computed por rol. Doctor advierte sobre la baja conjunta; Asistente advierte sobre su acceso/perfil/recursos y la conservación de pacientes, historiales y agenda del Doctor. | Aprobadas pruebas de cambio de rol/texto dentro de las 24 pruebas de aplicación de P05. Falta verificación visual después de despliegue. | [texto](src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.html), [mensaje por rol](src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.ts) |
| P12 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: estado visible de invitación creada/enviando/envío confirmado/fallo de envío; enlace copiable y Reintentar envío sobre el mismo registro/destinatario/enlace. Campos de lectura tras crear; no se vuelve a crear usuario al reintentar. Presentación mediante signals/computed. | 40 pruebas aprobadas en invitación, servicio de correo y directorio; build Angular development correcto. Falta verificación visual/SMTP tras despliegue. | [invitación](src/app/pages/doctors/dialogs/invite-doctor-dialog/invite-doctor-dialog.ts), [texto](src/app/pages/doctors/dialogs/invite-doctor-dialog/invite-doctor-dialog.html), [confirmación de respuesta](src/app/core/services/email.service.ts) |
| P13 | DECIDIDO / IMPLEMENTACIÓN LOCAL CON GATE CERRADA | Opción 1: duplicados rechazados por servidor; enlace aleatorio de un uso y siete días; reenvío sobre el mismo pendiente invalida el anterior. Registro controlado por token, sin borrar/recrear cuentas Auth existentes. | 211 pruebas sintéticas de backend/permisos aprobadas; validación Angular registrada abajo. Sin despliegue. Activación coordinada con P01 pendiente. | [implementación y activación](security/p13/IMPLEMENTACION_Y_ACTIVACION.md), [servidor](functions/src/staff-invitations.ts), [registro](src/app/pages/setup-profile/setup-profile.ts) |
| P14 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: raíz `/app` resuelve el destino con la sesión actual: Administrador → Doctores; Doctor/Asistente → Calendario. Conserva los guards de autenticación/rol y restricciones de cada pantalla. | 25 pruebas de rutas/login/guards aprobadas; build Angular de desarrollo correcto. Sin despliegue ni cambios de reglas. | [rutas](src/app/app.routes.ts), [pruebas de navegación](src/app/app.routes.spec.ts), [login](src/app/pages/login/login.ts) |
| P15 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: perfil propio de lectura del Paciente, con correo de acceso, nombres de pacientes asociados y Cerrar sesión. Diálogo desktop y página del portal hasta 768 px. No reutiliza el perfil del personal ni permite editar datos. | 79 pruebas aprobadas en cuatro archivos y build development correcto. Verificación visual desktop/mobile pendiente; sin despliegue. | [perfil del Paciente](src/app/shared/components/patient-profile/patient-profile.ts), [página mobile](src/app/pages/patient-profile-page/patient-profile-page.ts), [encabezado](src/app/shared/components/header/header.ts) |
| P16 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Cerrar sesión del Paciente redirige directamente a Acceso paciente (`/patient-login`) desde el diálogo desktop y la página mobile. | Verificación local detallada abajo; sin despliegue. | [cierre del Paciente](src/app/shared/components/patient-profile/patient-profile.ts), [pruebas](src/app/shared/components/patient-profile/patient-profile.spec.ts), [entrada paciente](src/app/pages/patient-login/patient-login.ts) |
| P17 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Paciente: sesión con máximo de una hora de inactividad; contraseña reutilizable y sin caducidad hasta renovación por Doctor. Recarga conserva tiempo restante; expiración vuelve a Acceso paciente y cierra diálogos del portal. | Verificación local detallada abajo; sin despliegue. Protección del acceso directo/invalidez remota sigue en P01. | [sesión](src/app/core/services/auth.service.ts), [pruebas](src/app/core/services/auth-patient-session.spec.ts), [salida de portal](src/app/pages/patient-layout/patient-layout.ts) |

### P12 — Resultado real y reintento de envío

Opción 1 confirmada por el usuario e implementada localmente el 9 de octubre de 2026:

- Se conserva la creación de un registro pendiente seguida del intento de correo. Persistir y enviar son operaciones distintas. Error de creación: no presenta enlace ni intenta enviar; mantiene borrador y permite volver a crear.
- Tras crear, nombre/correo quedan de lectura y se usa una copia inmutable de destinatario, nombre, invitador y enlace normalizado. El panel muestra «Invitación creada. Enviando el correo…» mientras espera; solamente después de confirmación muestra «Se envió el enlace al correo…».
- Ante fallo muestra permanentemente que la invitación está creada pero no se pudo confirmar el envío. Mantiene enlace/copia y ofrece Reintentar envío. El reintento no escribe otro documento ni cambia el enlace; usa el destinatario original aunque se manipulen controles. Si falla otra vez conserva este estado.
- El servicio exige HTTP correcto y respuesta callable `result.success === true`; error, JSON inválido, respuesta incompleta o fallo de red no se anuncian como éxito. Esto aplica también al reenvío ya existente en el directorio.
- Crear/guardar y cierre se bloquean durante petición; spinner, validaciones instructivas y botón deshabilitado por inválido/intacto/carga. No admite doble creación desde este panel ni reintentos simultáneos. Un cambio de sesión impide iniciar nuevos envíos desde el panel anterior y no publica alertas tardías en otra sesión.
- Copiar confirma el resultado del portapapeles y avisa si falla. Desktop conserva panel lateral; hasta 768 px acciones apiladas de ancho completo, con el mismo resultado/reintento.
- HTML usa signals/computed para presentación/formulario y handlers solo para eventos. Los estados de envío viven en este panel; no se guarda historial de entrega en Firestore. Al cerrarlo permanece el reenvío del directorio para perfiles pendientes.

**Verificación:** 40 pruebas sintéticas aprobadas (Invitar, EmailService y Doctores); compilación Angular de desarrollo correcta. Casos: creación/error, envío confirmado/fallido, respuesta incompleta/HTTP error, reintento sin duplicar documento, destinatario/enlace constantes, carga/doble envío, portapapeles, cambio de sesión y destrucción de vista. No hubo envío SMTP real, modificación de Functions/reglas/configuración ni despliegue.

**Límites:** confirmación significa que el servicio terminó el envío, no acredita recepción/lectura en bandeja. Una respuesta de red perdida podría corresponder a correo ya enviado; reintentar puede entregar más de un correo con el mismo enlace y consume cuota. P01 sigue pendiente como autoridad de backend; P13 ahora implementa duplicidad, token/caducidad y consumo del enlace en servidor preparado; nuevas altas/reenvíos requieren activar su servicio tras integrar P01. P12 queda cerrado localmente para el alcance elegido.

## Calendario, reservas y alta de pacientes

| ID | Estado | Observación / efecto | Qué verificar | Fuentes |
|---|---|---|---|---|
| P18 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Reagendar mobile abre el mismo formulario precargado que desktop y cierra el detalle. Disponible para Doctor, Asistente y Paciente habilitado; conserva paciente y validaciones. El handler rechaza al Paciente sin permiso. | 79 pruebas aprobadas en cuatro archivos; compilación registrada abajo. Validación visual en dispositivos reales pendiente; sin despliegue. | [eventos](src/app/pages/calendar/calendar.html), [apertura](src/app/pages/calendar/calendar.ts), [pruebas](src/app/pages/calendar/calendar.spec.ts) |
| P19 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Una cancelada no ocupa horario; el portal libera fecha/hora salvo que otra cita vigente la ocupe. Actualiza horas del formulario abierto; canceladas/deshabilitadas no generan advertencia de superposición. Presentación nueva con signals/computed. | 72 pruebas aprobadas en tres archivos; compilación registrada abajo. Sin despliegue. | [ocupación](src/app/pages/calendar/calendar.ts), [formulario](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [pruebas](src/app/pages/calendar/calendar.spec.ts) |
| P20 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Permitir conservar fecha/hora: el portal excluye por ID únicamente la cita editada antes de agrupar ocupación. Otra vigente sí bloquea, incluso a la misma hora o recibida con el formulario abierto. Doctor/Asistente conservan advertencia de superposición. | Verificación local registrada abajo; sin despliegue. La reserva sigue ocupando el calendario y los formularios de cita nueva. | [ocupación por ID](src/app/pages/calendar/calendar.ts), [pruebas integradas](src/app/pages/calendar/calendar.spec.ts), [conservar por rol](src/app/pages/calendar/dialogs/appointment-dialog/p20-diagnostic.spec.ts) |
| P21 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: cambiar Día limpia Hora si deja de ser válida para todos los roles y exige otra selección; la conserva si sigue válida. Guardar recalcula fecha/slots y rechaza una hora fuera de opciones o pasada hoy. Error presentado mediante signal. | Verificación local registrada abajo; sin despliegue. Mantiene ocupación/exclusión propia del Paciente y advertencia de superposición del personal. | [formulario](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [pruebas](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.spec.ts) |
| P22 | RESUELTO POR DECISIÓN / RIESGO ACEPTADO | El usuario considera muy poco probable la coincidencia por el reducido número de pacientes y decide conservar tiempo real con onSnapshot y validaciones actuales, sin reserva atómica adicional. El cierre es de revisión: no constituye una garantía técnica contra escrituras simultáneas. | Sin trabajo adicional solicitado para P22. Sin cambios funcionales ni despliegue. | [crear/guardar](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [reservas](src/app/core/repositories/appointment.repository.ts) |
| P23 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: Continuar acepta por separado correo compartido y nombre coincidente; el último guarda. Cambiar datos comprobados invalida aceptación. Errores separados; Añadir no salta avisos y pulsaciones durante guardado no duplican petición. Presentación nueva con signals/computed. | Verificación local registrada abajo. Sin despliegue ni cambios de datos/reglas. | [comprobación/Continuar](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts), [presentación](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.html), [pruebas](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.spec.ts) |
| P24 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: editar/borrar el texto retira la selección y exige elegir un resultado. Enfocar conserva selección; alta embebida autoselecciona; paciente fijo en historial/reagenda. Presentación modificada con signals/computed. | Verificación local registrada abajo. Sin despliegue ni cambios de datos/reglas. | [autocompletado/selección](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts), [pruebas](src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.spec.ts) |
| P25 | DECIDIDO / VERIFICADO SIN CAMBIO FUNCIONAL | Permitida la semana completamente cerrada. El formulario conserva cierre al guardar, aplicar, reabrir, reguardar y cargar otra agenda; no habilita fechas/horas en el portal ni cancela citas existentes. La reapertura automática sospechada no se reproduce en este recorrido. | Regresión integrada con datos sintéticos registrada abajo. Sin cambios de producción o despliegue. | [regresión guardar/aplicar/reabrir](src/app/pages/calendar/p25-closed-week.spec.ts), [ajustes](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts), [normalización](src/app/core/utils/availability.ts) |
| P26 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción 1: validar campos HH:mm, orden y solapamientos del mismo día en toda la semana. Mensajes identifican día/segmento. Permitir consecutivos y semana cerrada. Guardar bloqueado por invalid/pristine/saving; presentación con signals/computed. | Verificación local registrada abajo. Sin despliegue ni cambios de reglas/datos reales. | [validación/guardado](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts), [mensajes](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.html), [pruebas](src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.spec.ts) |
| P27 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | El empty state del calendario móvil ahora dice «No tienes consultas agendadas para este día.», coherente con el día seleccionado (antes decía «día de hoy»). | Verificación local abajo; falta comprobación visual tras despliegue. | [template](src/app/pages/calendar/calendar.html), [prueba](src/app/pages/calendar/calendar.spec.ts) |
| P28 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Referencia única del consultorio `America/Mexico_City`. `clinic-time.ts` + `ClinicClockService` separan el instante real del día civil; el calendario, la validación de fecha/hora de los tres roles, las entradas clínicas y la vigencia del portal usan esa referencia. Las fechas elegidas/guardadas siguen siendo civiles `YYYY-MM-DD` (sin desplazar el día a UTC). | Verificación local abajo; falta comprobar navegadores en otras zonas y el cambio de día cerca de medianoche. | [hora del consultorio](src/app/core/utils/clinic-time.ts), [reloj](src/app/core/services/clinic-clock.service.ts), [disponibilidad](src/app/core/utils/availability.ts), decisión del usuario del 9 de octubre de 2026 |

## Documentos, logo y datos clínicos

| ID | Estado | Observación / efecto | Qué verificar | Fuentes |
|---|---|---|---|---|
| P29 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A: el portal muestra, por tipo, el documento vigente más reciente. Recomendaciones y Receta se seleccionan por separado, así una receta anterior vigente ya no queda oculta por una consulta posterior con solo recomendaciones. Si el documento vigente de un tipo vence, se usa el siguiente vigente del mismo tipo. | Verificación local abajo; falta comprobación visual tras despliegue. | [selección y vigencia](src/app/pages/patient-history-view/patient-history-view.ts), [pruebas](src/app/pages/patient-history-view/patient-history-view.spec.ts) |
| P30 | DECIDIDO / VERIFICADO SIN CAMBIO FUNCIONAL | Decisión: una entrada clínica siempre se guarda para imprimir; no se ofrece guardar sin imprimir. Toda consulta se registra con la fecha de hoy del consultorio, sin fechas pasadas ni futuras. Con popup bloqueado el guardado se detiene y se muestra «Permite ventanas emergentes para imprimir». | Regresión local abajo; falta comprobación visual tras despliegue. | [botones](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.html), [guardado](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts), [pruebas](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.spec.ts) |
| P31 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A: se rechaza el cero en todas las medidas (entrada clínica y medidas al nacer) y se prohíbe la fecha de nacimiento futura en los tres formularios. Los rangos clínicos (mín/máx por campo) quedan para una fase B con aprobación del responsable clínico. | Verificación local abajo; faltan los rangos clínicos aprobados y la comprobación visual tras despliegue. | [validadores](src/app/core/utils/validators.ts), [consulta](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts), [completar](src/app/pages/patients/dialogs/complete-profile-dialog/complete-profile-dialog.ts), [editar](src/app/pages/patients/dialogs/edit-patient-dialog/edit-patient-dialog.ts), [alta](src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts) |
| P32 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Edición: se puede retirar un padre/madre, pero debe quedar **al menos uno** (validador de grupo `atLeastOneParent`); el alta y completar perfil siguen exigiendo ambos. Vacuna Anual: se mantiene una sola marca (sin historial por año), por decisión del usuario. | Verificación local abajo; falta comprobación visual tras despliegue. | [validadores](src/app/core/utils/validators.ts), [edición](src/app/pages/patients/dialogs/edit-patient-dialog/edit-patient-dialog.ts), [esquema](src/app/pages/patients/dialogs/complete-profile-dialog/complete-profile-dialog.ts) |
| P33 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | El encabezado ahora hereda el logo del Doctor propietario: Asistente lo resuelve por `createdBy` y Paciente por `doctorId` (`UserRepository.getUser`); Doctor usa su propio `logoPath`; Admin o ausencia de logo caen al logo de Lilcare. | Verificación local abajo; falta comprobación visual con un logo real. | [encabezado](src/app/shared/components/header/header.ts), [registro](src/app/pages/setup-profile/setup-profile.html), [pruebas](src/app/shared/components/header/header.spec.ts) |
| P34 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción C: `usePreloadedLogo` ahora es efectivo en la impresión. Precargado=true → logo Lilcare; false → logo propio del Doctor (fallback Lilcare). Se aplica en `print-preview`, `patient-history.printSection` y el preview de `impresion`; subir logo → false, eliminar → true. | Verificación local abajo; falta comprobación visual de la salida impresa. | [ajustes](src/app/pages/impresion/impresion.ts), [secciones](src/app/pages/patient-history/patient-history.ts), [vista de impresión](src/app/pages/print-preview/print-preview.ts) |
| P35 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A1+B1. Formatos unificados a PNG/JPG/SVG ≤ 1 MB en las dos rutas. La subida se difiere al guardar: `FileUpload` solo deja el archivo pendiente y expone `upload()`; cancelar (perfil) o `reset()` descarta sin escribir en Storage. Subir logo → `usePreloadedLogo: false`; eliminar → `true`. | Verificación local abajo; falta comprobación visual. | [archivo](src/app/shared/components/file-upload/file-upload.ts), [perfil](src/app/shared/components/profile-dialog/profile-dialog.ts), [setup](src/app/pages/setup-profile/setup-profile.ts), [impresión](src/app/pages/impresion/impresion.ts) |
| P36 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A: la edad impresa se calcula a la **fecha de la consulta** (`calcAgeAtDate`) en `print-preview` y `patient-history.printSection`, igual que en pantalla. Fallback de logo alineado a `DEFAULT_LOGO_URL`. No se unifica el pipeline (opción B pendiente/opcional). | Verificación local abajo; falta comprobar salidas impresas reales. | [secciones](src/app/pages/patient-history/patient-history.ts), [vista previa](src/app/pages/print-preview/print-preview.ts), [guardar/imprimir](src/app/pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts) |
| P37 | DECIDIDO / VERIFICADO SIN CAMBIO FUNCIONAL | Decisión: mantener la pestaña Gráficas visible con la calibración oculta (`calibration_enabled=false`), a reserva de la aprobación clínica externa. El repositorio no certifica clínicamente el esquema; la calibración/interpretación no se enseñan. | Falta la aprobación clínica externa y, si se habilita, la validación de la calibración. | [gráficas](src/app/pages/patient-history/components/growth-charts/growth-charts.ts), [controles](src/app/pages/patient-history/components/growth-charts/growth-charts.html) |

## Notificaciones, errores y código fuera del flujo normal

| ID | Estado | Observación / efecto | Qué verificar | Fuentes |
|---|---|---|---|---|
| P38 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | La campana móvil ahora es consciente del rol: Paciente → `/paciente/notificaciones` (ruta nueva que reutiliza `NotificationsPage`), personal → `/app/notificaciones`. En desktop sigue abriendo el diálogo. | Verificación local abajo; falta comprobación visual en móvil. | [campana](src/app/shared/components/notification-bell/notification-bell.ts), [rutas](src/app/app.routes.ts) |
| P39 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A: «Ver detalles» navega al calendario del rol (Paciente → `/paciente/calendario`; Doctor/Asistente → `/app/calendar`) y `close()` en modo página hace lo mismo. La lectura se marca con destino válido. | Verificación local abajo; falta comprobación visual con tutor. | [detalles](src/app/shared/components/notifications-dialog/notifications-dialog.ts), [roles](src/app/core/guards/role.guard.ts) |
| P40 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A: los destinatarios familiares se acotan al Doctor de la cita (solo hermanos con el mismo `doctorId`), coincidiendo con el grupo visible del portal. Un tutor puede tener varios expedientes (uno por Doctor) compartiendo correo, cada uno con su propia contraseña (ver contexto de dominio). | Verificación local abajo; falta comprobación con dos consultorios reales. | [familia/destinatarios](src/app/core/services/notification.service.ts), [grupo visible](src/app/core/repositories/patient.repository.ts) |
| P41 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | 1A: al cerrar se marcan leídas todas las canceladas (cargadas o no), sin cambio. 2B: la copia del actor se crea como `read: true` (no cuenta en su badge); el resto sigue no leída. | Verificación local abajo; falta comprobación visual. | [cierre](src/app/shared/components/notifications-dialog/notifications-dialog.ts), [lectura/destinatarios](src/app/core/services/notification.service.ts) |
| P42 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A: `patient-patients` y `patient-history-view` separan loading/error/vacío; ante fallo muestran mensaje y **Reintentar** (`load()`), y `loading` termina en falsy en todos los caminos (incluido `!patientId`). | Verificación local abajo; falta comprobación visual. | [niños](src/app/pages/patient-patients/patient-patients.ts), [historial](src/app/pages/patient-history-view/patient-history-view.ts) |
| P43 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Opción A: la impresión del Paciente avisa si el popup está bloqueado; cancelar/eliminar cita en el calendario usa `try/catch` con `alert.error` dedicado (sin éxito si falla). | Verificación local abajo; falta comprobación visual. | [impresión paciente](src/app/pages/patient-history-view/patient-history-view.ts), [cancelación](src/app/pages/calendar/calendar.ts) |
| P44 | DECIDIDO / IMPLEMENTADO EN LA APLICACIÓN | Se eliminó el código muerto (`dashboard`, `appointments`/walk-in y sus diálogos; redirecciones; selector de Doctor `@if(false)` y su handler). La **Bitácora** se conserva y **se agrega al Admin** como última entrada de su navegación (`/app/audit-log`, admin-only); se confirmó que los logs sí se generan (calendario, pacientes, configuración). El sidebar ahora se muestra para Doctor y Admin. | Verificación local abajo; falta comprobación visual. | [rutas](src/app/app.routes.ts), [sidebar](src/app/shared/components/sidebar/sidebar.ts), [audit-log](src/app/pages/audit-log/audit-log.ts), [layout](src/app/pages/doctor-layout/doctor-layout.ts) |

## Gestión de Administradores — nueva definición de producto

| ID | Estado | Definición solicitada / alcance | Qué queda por resolver | Fuentes |
|---|---|---|---|---|
| P45 | IMPLEMENTADO Y VERIFICADO LOCALMENTE / ACTIVACIÓN DEPENDE DE P01 | Admin gestiona Doctores y Administradores en áreas independientes; entrada Doctores y navegación Doctores → Administradores → Bitácora. Solo Admin incorpora Admin/Doctor. Admin/Doctor pueden crear Asistente en backend; el creado por Admin queda asociado a este para pruebas y sin agenda hasta tener Doctor válido. | Invitación/registro/reenvío, nombre/correo ajenos y baja administrativa implementados. Bloquea baja propia y conserva un Admin operativo mediante transacción; pendientes no cuentan. Perfil propio solo correo. No elimina Doctores creados por el Admin dado de baja. Integrar P01 y activar/probar servicios antes de considerarlo disponible en producción. | [verificación P45](security/p45/ANALISIS_Y_VERIFICACION.md), [regresión](security/p45/admin-management.spec.mjs), [emulador](security/p45/admin-management.emulator.spec.mjs) |

Registrado durante P04 por petición del usuario y completado localmente en P45 con aprobación de UI + invitación + seguridad. El usuario confirmó que el Asistente creado por Admin es de pruebas y queda asociado al Admin, sin agenda hasta tener un Doctor válido. Fuentes funcionales actualizadas para Admin y contexto compartido; no se activaron servicios ni se desplegó.

## Cómo registrar la verificación

Para cada ID, anotar estado final, versión probada, rol/dispositivo, pasos realizados con datos ficticios y decisión de producto cuando aplique. Un resultado reproducido puede confirmarse o descartarse; una diferencia de política puede aprobarse como comportamiento actual. Ninguna observación equivale automáticamente a una solicitud de corrección.

| ID | Resultado / decisión | Versión y dispositivo | Fecha / responsable |
|---|---|---|---|
| Por completar | Sin verificación ejecutada | Por completar | Por completar |

Una vez verificado un punto que cambie un procedimiento, actualizar el contexto del rol correspondiente. Mantener aquí la investigación de irregularidades; los contextos compartidos deben conservar información funcional sin mezclar este listado.

### P13 — Decisión aplicada localmente (9 de octubre de 2026)

Opción 1: evitar duplicados, invitación aleatoria de un uso con siete días de vigencia y reenvío sin crear otra cuenta. El servidor decide destinatario/rol/propietario; las URLs antiguas solo con correo ya no registran usuarios. Reenviar desde el directorio abre un panel con identidad de lectura y emite un nuevo enlace al confirmar. Reintentar envío dentro del panel conserva el enlace actual y su plazo.

El registro no borra/recrea Auth si el correo existe. Conserva un UID reservado para reintentos de provisión; activar perfil/autoridad y consumir enlace se confirma al final. Cambios de correo pendientes invalidan el enlace y trasladan su reserva; baja limpia metadatos propios. Registro interrumpido bloquea correo/baja hasta recuperar y completar el registro; reemitir autorizadamente sin lease activa permite recuperarlo sobre el mismo UID. Logotipo del invitado se configura después de iniciar sesión, desde Perfil; se evita upload anónimo en este flujo. Setup e invitación usan signals/computed para presentación.

**Estado de despliegue:** `STAFF_INVITATIONS_ENABLED` permanece false por defecto, sin despliegue ni cambios de reglas/configuración. No existe fallback al alta directa. Falta integrar la autoridad/protección de P01 y coordinar todos los escritores antes de habilitar los endpoints; esto incluye eliminar el acceso alternativo de identidades provisionales a completar perfiles. Manuales de producción deben validar activación y correo real antes de presentar el flujo como disponible.

**Verificación:** 211 pruebas sintéticas de P13/P09/P04/P01 aprobadas. Functions compiladas y lint sin errores (tres avisos de tipos previos en index). Compilación Angular de desarrollo aprobada. La repetición de la suite completa Angular aprobó 608 pruebas en 56 archivos; el timeout inicial de título de horarios no se reprodujo, y su repetición aislada aprobó 46 pruebas de horarios/invitación. La verificación final de registro/correo se detalla en P13. No se usaron pacientes/cuentas reales. Detalle: [P13](security/p13/IMPLEMENTACION_Y_ACTIVACION.md).

**Referencia legacy conservada:** AuthHandler de verificación de correo aún navega a una URL antigua con query email; Setup la rechaza, por lo que no permite un alta alternativa. No forma parte del nuevo flujo de invitación ni se encontró una acción visible que envíe ese correo de verificación. Requiere revisar este handler si se habilita posteriormente ese flujo. InvitationRepository conserva un lookup por correo sin consumidor actual; no se utiliza para autorizar registro.

### P14 — Entrada del personal por rol (9 de octubre de 2026)

Opción 1 aplicada: `/app` redirige según el rol de la sesión actual. Administrador entra a `/app/doctors`; Doctor y Asistente a `/app/calendar`. Es consistente con el login existente y la definición de entrada principal del Administrador. No se modifica el login ni se permite al Administrador entrar al Calendario. Los guards de la ruta destino y del área del personal permanecen activos; Paciente y sesión ausente/no autorizada siguen rechazados. No cambia el comportamiento de URLs específicas o aliases legacy.

Pruebas de Router sobre las rutas reales, sustituyendo únicamente la presentación de los componentes: entrada de tres roles, cambio de sesión/rol al volver a `/app`, denegación sin sesión/Paciente/rol desconocido y denegación de destinos explícitos no permitidos. Pasaron **25 pruebas en cuatro archivos** (rutas, authGuard, roleGuard y login); compilación de desarrollo correcta. No se introdujo presentación en HTML ni se cambiaron permisos de backend/configuración. Sin despliegue.

**Progreso de revisión actualizado:** recorrido inicial P02–P45 completado localmente, con cierres por implementación, verificación o decisión del usuario según cada entrada. P45 ya no está pendiente de implementación. **P01 permanece abierto**, con integración/despliegue y activación coordinada de los servicios preparados pendientes. La segunda revisión de cierres se registra al final: las pruebas actuales pasan, pero no certifican todas las variantes ni el ambiente real; las observaciones nuevas P46–P52 se revisarán individualmente, sin correcciones automáticas.

### P15 — Perfil de lectura del Paciente (9 de octubre de 2026)

Opción 1 aplicada: el encabezado distingue la sesión Paciente del personal y abre un componente propio. Muestra Correo de acceso y nombres de Pacientes asociados al correo principal/secundario utilizado para entrar, dentro del mismo Doctor. No presume identidad/nombre del tutor, no muestra contraseña, datos clínicos o logo y no incluye edición. Para sesiones antiguas sin `loginEmail` utiliza el correo principal del expediente, igual que el portal familiar existente. No se migraron datos.

En desktop abre diálogo con X; hasta 768 px navega a `/paciente/perfil`, bajo `authGuard` y `patientGuard`. La segunda pulsación del icono vuelve a `/paciente/calendario`, también cuando se entró directamente a Perfil. Cerrar el diálogo conserva la sesión. Correo largo puede envolver y la lista del diálogo puede desplazarse; página mobile conserva la navegación del portal. Presentación nueva y encabezado expuestos al HTML mediante signals/computed.

Carga, lista vacía y error son estados separados; el error ofrece Reintentar. Sin correo/Doctor asociado informa que se consulte al consultorio y no consulta una colección global. Filtra/deduplica resultados por Doctor y correo como defensa de pantalla, reduce el estado presentado a ID/nombre y descarta respuestas tardías tras cambio de sesión, logout o destrucción. Suscripción retirada al destruir la vista. Esto no reemplaza la protección de acceso directo pendiente en P01.

Cerrar sesión espera la operación, impide doble envío/cierre durante la solicitud y muestra una alerta si falla. No navega sobre otra sesión iniciada entretanto. P15 conservó inicialmente `/login`; P16 cambia posteriormente ese destino a `/patient-login`. No hay escrituras de perfil, cambios de rules/configuración ni nuevo mecanismo de autenticación.

**Verificación local:** 79 pruebas aprobadas en cuatro archivos: perfil del Paciente, encabezado, rutas reales con presentación sustituida y regresión del perfil del personal. Comprueban correo secundario/fallback, varios pacientes, exclusión de ajenos/no asociados/duplicados, carga/vacío/error/reintento, respuestas tardías/logout/cambio de cuenta/destrucción, lectura en diálogo/página, cierre sin logout, logout correcto/fallido/en curso y protección de ruta. Compilación Angular de desarrollo aprobada. Datos sintéticos y servicios simulados; sin screenshots, cuentas reales o despliegue.

### P16 — Salida hacia Acceso paciente (9 de octubre de 2026)

Decisión explícita del usuario aplicada: Cerrar sesión desde Perfil del Paciente termina la sesión y navega a `/patient-login`, tanto en el diálogo desktop como en la página mobile. Conserva la espera de logout y el bloqueo de doble envío, y no navega si se estableció otra sesión entretanto. No cambia los destinos de cierre del personal ni las rutas de los guards.

**Verificación local:** 16 pruebas del perfil del Paciente aprobadas, con compilación del bundle de pruebas correcta. La prueba de salida cubre por separado diálogo y página sin proveedor de diálogo; comprueba sesión terminada, destino Acceso paciente y retirada de datos del acceso anterior. Las pruebas existentes de fallo, solicitud en curso y cambio de cuenta siguen aprobadas. Sin despliegue ni operaciones con cuentas reales.

### P17 — Inactividad de sesión y contraseña reutilizable (9 de octubre de 2026)

Decisión explícita: la sesión del Paciente dura como máximo una hora de inactividad; la contraseña se reutiliza y no expira hasta que el Doctor la renueva. La comparación de contraseña en login se conserva: no consume códigos, no escribe una fecha de caducidad ni modifica las contraseñas.

El temporizador propio del Paciente toma última interacción: clic, teclado, movimiento del puntero, pointerdown, touchstart y desplazamiento. Escucha fuera de Angular y entra para publicar el cierre. Ignora eventos de una pestaña oculta. Al recuperar visibilidad/foco o pageshow comprueba el plazo sin ampliarlo; una interacción tardía tampoco revive una sesión ya vencida. Caducar publica sesión null, retira cache/timers/listeners y navega a Acceso paciente. PatientLayout cierra diálogos al perder sesión para que no cubran el login; logout manual sigue navegando incluso si ese cierre destruyó su diálogo. No hay aviso/countdown previo ni guardado automático de borradores.

Persistencia de la última actividad en `pediatrify_patient_activity` de sessionStorage, vinculada al paciente/Doctor/correo del acceso. Restablece solo tiempo restante al recargar. Cache caducada, ausente, de otra identidad, con fecha futura/no válida o sin metadatos se descarta antes de publicar la sesión. Una sesión vieja sin fecha debe iniciar sesión de nuevo; no hay migración de datos. Si no puede guardar el plazo, retira la cache para exigir login al recargar; el temporizador de la sesión actual sigue activo. El guard de rutas `/paciente` sin sesión utiliza `/patient-login`; el resto conserva `/login`. El servicio limpia sus listeners/timers al destruirse.

**Límites:** vencimiento aplicado por el cliente y por pestaña, sin nueva autoridad/backend ni cambios de reglas. Un navegador suspendido no ejecuta código al momento del plazo: se comprueba al reanudarse/primer evento. No reemplaza P01, no impide manipular almacenamiento/reloj local ni revoca por sí mismo otros accesos o solicitudes ya enviadas. Renovar contraseña cambia próximos logins; la invalidación inmediata de sesiones remotas ya abiertas requiere protección adicional de P01.

**Verificación específica:** 68 pruebas aprobadas en siete archivos: sesión Paciente, regresión de acceso/correo/invitación de personal, guard, rutas, perfil y layout del portal. Comprueban límite exacto, eventos desktop/mobile, restauración sin ampliar el plazo, cache inválida/de otro acceso, pestaña suspendida, evento tardío, contraseña reutilizada/renovada, logout manual, cambio a personal, cleanup y error de persistencia. Suite completa: **676 pruebas aprobadas en 60 archivos**; compilación Angular de desarrollo correcta. JSDOM emitió avisos «Could not parse CSS stylesheet» sin fallos de prueba; no se cambiaron estilos en P17. Datos sintéticos; sin cuentas reales ni despliegue.

### P19 — Cancelar libera el horario (9 de octubre de 2026)

Decisión explícita aplicada: las citas canceladas dejan de contar como ocupación. En modo Paciente, el listener filtra canceladas/deshabilitadas antes de calcular horas y días ocupados y la agenda familiar visible. Una segunda cita vigente a la misma fecha/hora sigue ocupando el horario. El formulario abierto recibe las nuevas claves de ocupación y las citas familiares, actualiza opciones y avisos mediante signals/computed y permite guardar una reserva en la hora liberada; no requiere cerrarlo/reabrirlo. Las referencias a formularios se retiran al cerrar o destruir el calendario.

El personal también excluye canceladas/deshabilitadas de los candidatos de superposición; el formulario comprueba esos estados al generar el aviso, incluso con un origen distinto al calendario. No se borran documentos cancelados ni se crea una cita de reemplazo automáticamente. Se conservan fechas futuras, segmentos/duración, permisos y la política actual de superposición del personal. P19 no abordó la conexión mobile de Reagendar ni la exclusión de la propia cita, atendidas posteriormente en P18/P20. P22 se cerró posteriormente por decisión del usuario, sin añadir reserva exclusiva entre sesiones.

**Verificación local:** 72 pruebas aprobadas en tres archivos (calendario, asociación y formulario de cita); compilación Angular de desarrollo correcta. Casos nuevos cubren hora/día liberados, cancelada junto a otra vigente, deshabilitada, ocupación ajena sin nombres en la agenda propia, actualización del formulario abierto, retiro al cerrar, reserva efectiva tras liberar la hora, nueva ocupación que sigue bloqueando y avisos sin canceladas/deshabilitadas. Datos sintéticos, sin cuentas reales ni despliegue.

### P20 — Diagnóstico previo a la decisión (9 de octubre de 2026)

Ante la consulta del usuario, se comparó el código actual con el último commit local, `76791ac`. En ambos, el modo Paciente filtra/valida el horario contra el conjunto de ocupación recibido, sin excluir por ID la cita editada. Por tanto, la comprobación que puede bloquear la hora propia no fue introducida por los cambios recientes de P19. Esta es una comparación estática del commit; no demuestra qué build o rol se usó en una sesión anterior del usuario.

Diagnóstico ejecutado sobre el formulario actual con datos sintéticos, misma fecha/hora futura, Doctor con segmentos disponibles, una única cita vigente (la propia), y edición solo del motivo:

- Doctor: la hora original sigue disponible, actualiza la misma cita y cierra correctamente.
- Asistente: mismo resultado; conserva la hora y actualiza la cita de su Doctor asociado.
- Paciente con reservas habilitadas: la hora original queda fuera de opciones; Guardar no actualiza y muestra «Esa hora ya está ocupada. Elige otra hora disponible.».
- Guardar solo motivo no genera notificación de cambio de fecha/hora en los dos roles que sí pudieron guardar.

**Verificación en esa etapa:** tres casos diagnósticos aprobados con el bundle de pruebas compilado. En ese momento no se modificó funcionalidad, datos, configuración o reglas para P20; sin cuentas reales/despliegue. Después de la decisión explícita, `src/app/pages/calendar/dialogs/appointment-dialog/p20-diagnostic.spec.ts` se actualizó como regresión del comportamiento elegido: los tres roles conservan fecha/hora cuando no hay otra ocupación y no envían aviso de reagenda si solo cambia motivo. La implementación y comprobación integrada se registran más abajo.

**Propuesta concreta:** calcular las horas ocupadas para la reagenda excluyendo únicamente el ID de la cita editada, tanto al abrir como en las actualizaciones recibidas. Conservar el bloqueo si otra cita vigente comparte la misma fecha/hora; no retirar una clave completa por coincidir con la hora original. El Paciente podría mantener fecha/hora y editar motivo, sujeto a las restricciones vigentes de fecha/horario y permiso de reserva. No ampliar permisos del Paciente ni cambiar la política actual del personal.

### P18 — Reagendar habilitado en mobile (9 de octubre de 2026)

Decisión explícita aplicada: conectar Reagendar del detalle móvil al mismo formulario de edición que desktop. Doctor y Asistente acceden en su agenda autorizada; Paciente solo cuando su Doctor permite agendar. El handler comprueba ese permiso además del botón oculto. Al abrir se retiran el detalle expandido y la selección/overlay, y se muestra el formulario precargado en el panel inferior existente. Conserva el paciente de la cita, las validaciones y la actualización de la reserva original; cerrar sin guardar no la modifica. No se añadieron funciones ni variables de presentación al HTML: el nuevo enlace es un handler de evento y el cierre usa signals existentes.

**Verificación local:** 79 pruebas aprobadas en cuatro archivos: calendario, asociación de agenda, formulario de cita y diagnóstico P20. Cuatro casos nuevos pulsan el botón del detalle móvil renderizado para Doctor, Asistente y Paciente habilitado; comprueban apertura con cita/Doctor/modo correctos y cierre del detalle. El cuarto comprueba botón oculto y rechazo del handler para Paciente sin permiso. Compilación Angular de desarrollo correcta y revisión de whitespace sin errores. Las pruebas usan DOM de pruebas y datos sintéticos, sin capturas ni validación visual en dispositivos reales. Sin despliegue ni cambios de datos, reglas o configuración.

En la etapa P18, P20 seguía pendiente: habilitar el acceso móvil no modificó el cálculo de ocupación de la propia cita. P20 se decidió e implementó posteriormente según el registro siguiente. Los contextos funcionales describen la entrada desktop/mobile y recomiendan capturas separadas del formulario.

### P20 — Permitir conservar fecha/hora sin contar la propia cita (9 de octubre de 2026)

Decisión explícita del usuario: «Permitir conservarla, sin contar la propia cita como ocupación; otra cita vigente sí cuenta». Se conserva una proyección mínima de las citas vigentes del Doctor (`id`, `date`, `time`) en un signal. Los conjuntos de días/horas ocupados del calendario se derivan mediante computed. Al abrir cada formulario del Paciente y al recibir actualizaciones, se filtra únicamente el ID editado antes de generar el conjunto de claves fecha/hora. Otra reserva de la familia o ajena al mismo horario mantiene el bloqueo. No se borra una clave solo por coincidir con la fecha/hora inicial.

La edición mantiene el paciente fijo y actualiza el documento original. Si solo cambia motivo, conserva fecha/hora y no genera notificación de reagenda. Una hora distinta ocupada sigue rechazada; elegir otra libre permite guardar y notificar. La cita editada sigue ocupando el calendario y los formularios nuevos, que no excluyen ningún ID. Los formularios abiertos reciben la ocupación vigente y dejan de recibirla al cerrarse. Se mantienen permiso de reserva, restricciones de fecha/horarios y advertencia de superposición del personal. No hay cambios del HTML ni nuevas funciones/variables de presentación; no cambia el modelo persistido o las consultas de Firestore.

**Verificación local:** 85 pruebas aprobadas en cuatro archivos (calendario, asociación, formulario y regresión por rol). Seis casos integrados nuevos usan el formulario real con la ocupación proporcionada por el calendario: guardar la propia hora y motivo, otra vigente en la misma hora, cancelada, deshabilitada, entrada/cancelación de otra cita mientras se edita y retiro al cerrar, otra hora ocupada seguida de cambio a una libre. Los tres casos por rol ahora verifican conservar hora sin otra ocupación. También pasan las regresiones P18/P19 y los controles previos de disponibilidad. Datos sintéticos; sin cuentas reales, cambios de reglas/configuración ni despliegue. La exclusión entre sesiones simultáneas de P22 no se resuelve con este cambio.

Compilación Angular de desarrollo correcta; revisión de whitespace sin errores. Los contextos Doctor, Asistente, Paciente, compartido y proyecto se actualizaron con el comportamiento elegido. La verificación usa DOM de pruebas y repositorios simulados; no acredita una prueba contra producción ni una validación visual en dispositivos reales.

### P21 — Limpiar una hora inválida al cambiar de día y comprobarla al guardar (9 de octubre de 2026)

Opción 1 autorizada: al cambiar Día, Doctor, Asistente y Paciente conservan Hora únicamente si pertenece a las opciones del nuevo día. Si no, se limpia y required exige seleccionar otra; paciente y motivo se conservan. Aplica al formulario compartido de calendario e historial y a su presentación desktop/mobile. Una fecha pasada/cerrada/inválida no ofrece horas.

Antes de guardar se recalculan las horas con la fecha seleccionada, segmentos, duración y hora local actual. La fecha se comprueba también cuando el formulario la contiene como string. Se rechaza una hora fuera de segmentos, en un hueco entre segmentos, no alineada con la duración, que no permita terminar la consulta o ya pasada hoy. Mensaje: «Selecciona una hora disponible dentro del horario del doctor para el día elegido.». No escribe, notifica ni cierra hasta corregir. El error del formulario ahora es un signal y se presenta mediante `error()`; no se añadieron funciones ni variables ordinarias para mostrar este estado en HTML.

Se conserva la comprobación de ocupación del Paciente y la exclusión por ID de su propia cita P20. Para personal, otra reserva a una hora válida sigue generando advertencia de superposición y permite guardar. Esta validación local no constituye una reserva exclusiva entre sesiones y no resuelve P22. No cambia modelos, consultas, reglas, configuración o datos reales.

**Verificación local:** 108 pruebas aprobadas en cinco archivos: calendario, asociación, formulario, conservar hora por rol e historial. Dieciocho casos nuevos comprueban limpieza y posterior selección, conservación de hora válida para los tres roles, rechazo al crear/editar con hora introducida directamente, huecos, alineación/duración, día cerrado, fecha pasada como string, paso del tiempo durante el formulario y superposición del personal. También pasan las regresiones P18–P20. Se ajustaron los datos de pruebas previas de autorización para proporcionar un horario válido y la fecha del caso de paciente fijo para que sea futura; siguen comprobando autorización y persistencia con paciente fijo. Repositorios simulados y datos sintéticos; sin cuentas reales/despliegue.

Compilación Angular de desarrollo correcta y revisión de whitespace sin errores. Contextos funcionales y de proyecto actualizados. La presentación usa DOM de pruebas; capturas y comprobación visual en dispositivos reales pendientes.

### P22 — Aclaración sobre tiempo real y cierre por decisión (9 de octubre de 2026)

El usuario propone que `onSnapshot` actualice los calendarios para evitar conflictos. **CONFIRMADO:** `AppointmentRepository.watchAppointmentsByDoctor()` ya usa `onSnapshot`; Calendar escucha los cambios y actualiza la agenda. En el portal también actualiza ocupación y formularios abiertos, con exclusión por ID de la cita editada tras P20. No falta activar tiempo real para este flujo.

**CONFIRMADO en implementación / conflicto simultáneo aún no reproducido:** guardar comprueba el conjunto de ocupación local y después crea/actualiza un documento de cita con ID individual mediante `setDoc`/`updateDoc`. Esa secuencia no coordina dos escrituras sobre el mismo Doctor/fecha/hora. Dos formularios pueden comprobar libre antes de que cualquiera reciba la reserva del otro. Añadir otra lectura previa tampoco garantiza exclusión por sí sola.

**Recomendación presentada y no adoptada:** mantener listeners y añadir comprobación/reserva atómica de ocupación al guardar en el portal, coordinada con todos los escritores y con cancelación/reagenda/baja. El usuario decidió no añadirla por considerar muy poco probable el conflicto con el reducido número de pacientes. No se modifica código para P22.

**Cierre explícito:** P22 queda RESUELTO POR DECISIÓN / RIESGO ACEPTADO. Se mantiene onSnapshot y la política actual de reservas, cancelación y reagenda, incluyendo exclusión de la propia cita. No se requiere otra decisión o prueba simultánea para cerrar este punto dentro de la revisión solicitada. La probabilidad baja es una valoración del usuario, no una medición obtenida del repositorio. No se declara corregida técnicamente la posibilidad de conflicto; sin cambios funcionales ni despliegue.

Fuentes revisadas: `src/app/core/repositories/appointment.repository.ts`, `src/app/pages/calendar/calendar.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`; documentación oficial de [listeners](https://firebase.google.com/docs/firestore/query-data/listen) y [transacciones](https://firebase.google.com/docs/firestore/manage-data/transactions). Después de este cierre quedaban 23 puntos; el contador actual se encuentra en Progreso de revisión.

### P23 — Diagnóstico previo de Continuar en el alta (9 de octubre de 2026)

**CONFIRMADO en código:** el formulario de alta, tanto independiente desde Pacientes como embebido en Agendar, detecta correos ya usados o coincidencia de nombre dentro del Doctor asociado. Muestra el aviso y retorna. `continueWithExisting()` borra `alertMsg` y vuelve a llamar `save()`; esa llamada vuelve a comprobar los mismos datos con el aviso vacío y repite la advertencia. No hay un estado independiente que registre la aceptación explícita. Doctor y Asistente utilizan este formulario; Paciente no realiza altas.

El botón Añadir paciente puede saltar ambas comprobaciones si `alertMsg` sigue lleno, porque los avisos dependen de `!alertMsg`. El mismo texto también se usa para errores de guardado. Para corregir el flujo conviene separar aviso, error y confirmación, y vincular la aceptación a los datos comprobados; cambiar correo/nombre debe volver a comprobarlos. Esta revisión es estática, sin nuevos casos ejecutados ni cambios funcionales para P23.

Opciones propuestas en esa etapa: (1) conservar los avisos por correo/nombre y permitir que Continuar confirme cada coincidencia y termine el alta; si hay dos advertencias, aceptar ambas antes de guardar; (2) permitir el correo compartido sin confirmación bloqueante y conservar confirmación para coincidencia de nombre. Ambas permiten registrar hermanos con el correo del tutor, sin convertirlo en una prohibición de duplicados. El usuario eligió posteriormente la opción 1; implementación registrada abajo.

Fuentes: `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.ts`, `src/app/pages/calendar/dialogs/new-patient-dialog/new-patient-dialog.html`, `src/app/pages/patients/patients.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.html`.

### P23 — Continuar confirma coincidencias y termina el alta (9 de octubre de 2026)

Opción 1 aplicada: conservar los avisos y exigir aceptación explícita. Se separan aviso pendiente (`email` o `name`), tipos aceptados y error de guardado. El primer aviso aplicable es el de correo; si también coincide nombre, el primer Continuar presenta ese segundo aviso y el siguiente guarda. Si solo hay una coincidencia, un Continuar basta. Añadir paciente no acepta implícitamente avisos pendientes, ni al pulsar su handler directamente. Compartir correo para hermanos y confirmar nombres iguales continúa permitido dentro del mismo Doctor.

La aceptación queda ligada a Doctor, correo principal, secundario y nombre normalizados. Cambiar estos datos invalida las confirmaciones y retira el aviso; Añadir vuelve a comprobarlos. Una modificación silenciosa del FormGroup o cambio de ámbito se verifica otra vez al intentar Continuar/guardar. Recibir otra lista de pacientes también invalida la aceptación. Cambiar solo teléfono no repite avisos aceptados. Formulario inválido impide aceptar/guardar.

`alertMsg` es computed del aviso; `saveError`, `saving` y estado del formulario son signals. La presentación nueva del template consume signals/computed. Añadir/Actualizar se deshabilita si el formulario es inválido, pristine, hay aviso pendiente o petición en curso. Continuar se deshabilita durante guardado o con campos inválidos. Ambas operaciones rechazan una segunda petición mientras se guarda. Los eventos de formulario se retiran al destruirse el componente. El error de guardado se muestra aparte y no tiene Continuar; un reintento explícito mantiene aceptación si los datos siguen iguales. No convierte altas en operaciones idempotentes ni modifica envío/credenciales, consultas, reglas o modelo persistido.

**Verificación local:** 160 pruebas aprobadas en seis archivos (alta, formulario de cita, pacientes, calendario, asociación y conservar hora por rol). Diecinueve casos nuevos cubren Continuar real en Doctor independiente/Asistente embebido, nombre, dos avisos consecutivos, imposibilidad de saltarlos con Añadir, cuatro cruces de correo principal/secundario, normalización, cambios de datos con/sin eventos, teléfono, lista y ámbito de Doctor, formulario inválido, error/reintento y pulsaciones durante petición. También pasan las regresiones P18–P21 y flujos existentes de alta/edición/envío/retorno a cita. JSDOM emitió avisos «Could not parse CSS stylesheet» sin fallos; no se cambiaron estilos para P23. Datos sintéticos y repositorios simulados; sin cuentas reales, capturas o despliegue.

Compilación Angular de desarrollo correcta y revisión de whitespace sin errores. Contextos Doctor, Asistente, compartido y proyecto actualizados, con screenshots sugeridos de ambos avisos y error separado. La verificación no acredita una prueba de producción o validación visual en dispositivos reales.

### P24 — Diagnóstico previo a la decisión (9 de octubre de 2026)

Revisión estática antes de la corrección: `onPatientSelected()` guardaba el ID del paciente y el objeto seleccionado. Escribir después en la búsqueda solo filtraba opciones; no retiraba el ID anterior. Guardar una cita nueva utilizaba ese ID aunque el texto visible hubiera cambiado. En reagenda y entrada desde historial el paciente se presentaba fijo, por lo que la corrección debía conservar esos casos.

Opciones propuestas: (1) al editar el texto, limpiar la selección anterior y exigir elegir un resultado válido antes de guardar; (2) presentar la selección fija con una acción Cambiar paciente que abra de nuevo la búsqueda. El usuario eligió la opción 1; implementación registrada abajo. Fuentes: `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.ts`, `src/app/pages/calendar/dialogs/appointment-dialog/appointment-dialog.html`.

### P24 — Exigir una nueva selección después de editar el texto (9 de octubre de 2026)

Opción 1 aplicada al formulario compartido: el cambio de texto libre limpia patientId cuando el paciente no está bloqueado. Tras retirar una selección, marca touched y muestra «Selecciona un paciente de los resultados de búsqueda.». Agendar queda deshabilitado; el handler tampoco escribe, notifica ni cierra mientras el paciente requerido esté vacío. Incluso volver a escribir el nombre anterior requiere elegir un resultado. Elegir una opción guarda su ID y objeto, conservando día, hora y motivo. Enfocar/desplegar o filtrar sin editar conserva la selección.

El control de búsqueda está dentro del FormGroup. La presentación modificada consume signals/computed: paciente fijo/nombre, validación de selección, submitted, saving y disabled por invalid/pristine/guardado. Eventos del formulario mantienen el estado derivado; las suscripciones nuevas tienen teardown al destruirse. Guardar rechaza otra petición mientras hay una en curso. No se refactorizaron las restantes expresiones legacy del template.

Desde historial y al reagendar, el paciente sigue fijo; el bloqueo se activa antes de precargar el buscador para conservar el ID también cuando solo hay un nombre de respaldo. onPatientSelected no sustituye un paciente bloqueado. El alta embebida sigue recargando el padrón autorizado y autoseleccionando al recién creado. Doctor, Asistente y familia con varios niños usan la misma regla de búsqueda; paciente único conserva el flujo fijo. No cambia permisos, consultas, modelos persistidos, reglas, configuración ni datos reales.

**Verificación local:** 175 pruebas aprobadas en siete archivos: formulario de cita, alta, calendario, asociación, regresión de propia hora, pacientes e historial. Diez casos nuevos cubren edición mediante input real por los tres roles, texto vacío/igual al nombre anterior, foco sin pérdida de selección, paciente fijo en historial/reagenda, respaldo sin objeto y teardown. Se amplió la comprobación de autoselección tras alta. Pasan también las regresiones P18–P23. Datos sintéticos y repositorios simulados; JSDOM emitió avisos de CSS sin fallos. Sin cuentas reales, capturas ni despliegue. Compilación Angular de desarrollo correcta; revisión de whitespace sin errores.

Contextos Doctor, Asistente, Paciente, compartido y proyecto actualizados, con capturas sugeridas de selección retirada y validación en desktop/mobile. No acredita prueba contra producción o validación visual en dispositivos reales.

### P25 — Revisión previa de semana sin segmentos (9 de octubre de 2026)

Revisión estática: SettingsDialog conserva entradas vacías por día al quitar segmentos; save sincroniza al menos el día seleccionado y publica ese mapa con claves, aunque availableDays sea []. buildAvailabilityFromUser detecta las claves antes de retirar los arrays vacíos, por lo que esa salida del formulario conserva semana cerrada al aplicarse o leerse nuevamente. No se ha reproducido la reapertura por defecto en el recorrido normal de la UI. Diferencia confirmada: un mapa literalmente vacío {} recibido desde otro origen sí activa los horarios por defecto; no equivale al mapa con días y arrays vacíos que guarda el formulario. Sin prueba nueva ni cambio funcional para P25 en esta etapa.

Opciones propuestas en esa etapa: permitir cerrar toda la semana y verificar el recorrido guardar/aplicar/reabrir con una regresión específica, o exigir al menos un día con segmento antes de guardar. El usuario autorizó posteriormente la primera; ver registro de cierre abajo. Fuentes: `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`, `src/app/core/utils/availability.ts`, `src/app/pages/calendar/calendar.ts`.

### P28 — Referencia horaria del consultorio definida (9 de octubre de 2026)

**CONFIRMADO POR EL USUARIO, como definición operativa:** «la hora es la del centro de México la que se usa en el consultorio actualmente». Las horas configuradas y acordadas para las citas deben interpretarse con esa referencia. Identificador propuesto para representarla: `America/Mexico_City`, identificado por IANA para el centro de México; no utilizar el nombre genérico CST ni un desplazamiento fijo como sustituto de la zona. Referencia externa: [nombres de zonas IANA](https://data.iana.org/time-zones/tzdb-2022b/theory.html).

**CONFIRMADO EN EL CÓDIGO ACTUAL:** futureSlotsForDate/isDateSelectable comparan el día y la hora con new Date(), getFullYear/getMonth/getDate y getHours/getMinutes del navegador. todayLocalDateString también obtiene el día local del dispositivo. No se encontró una conversión explícita a la zona del consultorio en estas utilidades. Por tanto, no se afirma que el sistema ya aplique la definición cuando el dispositivo utiliza otra zona.

**Implementación pendiente:** separar el instante actual de sus partes civiles en la zona del consultorio y emplearlas coherentemente para hoy, fechas pasadas y horas ya transcurridas en la agenda. Mantener las fechas elegidas y almacenadas como fechas civiles, sin desplazar el día al convertirlas a UTC; verificar el calendario y los formularios de los tres roles que reservan, especialmente cerca de medianoche desde otra zona. Las fechas de nacimiento y la duración de sesión por inactividad no deben cambiar por esta decisión. Estos son criterios para la implementación, no cambios ya realizados.

Esta actualización registró la definición y su diferencia con la implementación; no modificó producción, configuración, datos ni reglas. En esa etapa P28 contaba entre los puntos con trabajo pendiente; se implementó posteriormente según el registro final. P25 esperaba decisión; se autorizó y verificó según el registro siguiente.

### P25 — Semana completamente cerrada permitida y verificada (9 de octubre de 2026)

Decisión explícita: permitir toda la semana cerrada y verificar guardar/aplicar/reabrir con regresión. No fue necesario cambiar funcionalidad: SettingsDialog ya permite eliminar todos los segmentos, publica availableDays [] y conserva claves con arrays vacíos. El calendario normaliza el resultado a mapa {} y días [], sin reabrir la semana. Al abrir otra vez Configuración, setData recibe ese estado sin añadir horarios; reguardar sincroniza al menos el día seleccionado como lista vacía y la siguiente carga sigue cerrada.

Regresión integrada nueva: `src/app/pages/calendar/p25-closed-week.spec.ts`. Tres escenarios usan los componentes reales con repositorios/SDK simulados: Doctor con siete días y dos segmentos por día, Asistente con la misma configuración y Doctor con formulario inicialmente vacío. Los dos primeros pulsan chips y botones de eliminar hasta vaciar todos los días. Guardar se pulsa en el DOM y se espera su resultado; se comprueba escritura merge, arrays vacíos, permiso de reservas conservado y alerta de éxito. El calendario inicial permanece abierto hasta aplicar el resultado del diálogo; entonces queda cerrado. Se reabre Configuración desde ese calendario, se verifican los siete días sin campos/checks, se guarda otra vez y una nueva instancia relee el documento simulado. El portal usa ese mismo estado: todos los días futuros de una semana quedan no seleccionables, no hay horas, guardar una cita no escribe y las citas ya existentes se conservan. El Asistente no escribe allowPatientScheduling.

**Verificación local:** 149 pruebas aprobadas en seis archivos: regresión P25, Configuración, Calendario, asociación de agenda, disponibilidad y formulario de cita. Tras reforzar la comprobación de transición abierto → cerrado, se repitieron los tres casos P25: los tres aprobados. El bundle de pruebas compiló correctamente; revisión de whitespace sin errores. No se ejecuta un build de producción adicional porque solo se añadieron pruebas/documentación, sin cambios de código de producción/configuración/reglas. Sin cuentas reales, emuladores, capturas ni despliegue.

**Límite confirmado:** un documento generado por otro origen con timeSegmentsByDay literalmente {} y availableDays [] sigue activando defaults en buildAvailabilityFromUser; no es lo que persiste el formulario al guardar, ni se detectó una ruta normal de reapertura que lo escriba así. No se modifica ese comportamiento ajeno al recorrido autorizado ni se propone migración. Los mocks verifican payload y lectura del estado, no reglas desplegadas ni una sesión contra Firebase real. La primera ejecución de los tres casos falló por usar MatDialog real desde el provider del módulo; se corrigió el aislamiento del diálogo en la prueba, sin tocar la aplicación. No se atribuye ese fallo al flujo del usuario.

Contextos Doctor, Asistente, Paciente, compartido y proyecto actualizados, con capturas sugeridas de configuración cerrada/reabierta y portal sin fechas/horas. P25 queda cerrado para el recorrido actual de la UI. La validación de segmentos inválidos pertenece a P26; la hora del centro de México definida en P28 se implementó posteriormente según el registro final.

### P26 — Validar campos, orden y solapamientos de toda la semana (9 de octubre de 2026)

Opción 1 aplicada. Inicio/Fin obligatorios con patrón HH:mm de 24 horas; el final debe ser posterior al inicio. Fin 00:00 conserva el significado 1440 minutos/final del día: 22:00–00:00 y 00:00–00:00 son válidos. Intervalos idénticos, parcialmente solapados o contenidos uno en otro se rechazan en el mismo día. Se comparan todos los pares sin ordenar el borrador. Adyacentes y huecos son válidos; horas iguales en días distintos no entran en conflicto. No se valida contra citas ya existentes ni se modifica la política de superposición de reservas.

El FormGroup valida toda la semana, superponiendo los valores actuales del día activo al mapa de otros días. Cambiar a otro día no permite esconder o perder un error; los valores inválidos se conservan para corregirlos o eliminarlos. La lista «Corrige los horarios indicados antes de guardar.» identifica día, segmento e instrucción. Mensajes: «Ingresa una hora de inicio válida en formato HH:mm.», «Ingresa una hora de fin válida en formato HH:mm.», «Elige una hora de fin posterior a la de inicio. Usa 00:00 para el final del día.» y «Modifica este segmento para que no se superponga con otro del mismo día.». La duración requiere valor positivo y muestra «Selecciona una duración de consulta válida.».

Mapa por día, día seleccionado y saving pasan a signals. Snapshot del formulario alimenta computed de chips, filas, errores, duración inválida y botón. Toda presentación del template de Configuración consume signals/computed o variables locales de @for; no llama isConfigured ni lee getters/campos ordinarios de estado. FormArray sigue dentro del mismo FormGroup. Eventos se retiran con takeUntilDestroyed. Guardar bloquea invalid/pristine/saving; su handler revalida antes de cualquier lectura/escritura y rechaza otra petición durante guardado. Añadir/quitar marca dirty; solo recorrer los días no. No se añaden campos persistidos ni se cambian consultas, reglas o configuración Firebase.

La semana completamente cerrada permanece permitida. La regresión P25 sigue pasando; el escenario inicialmente vacío ahora añade/retira un segmento para registrar una modificación explícita, y la segunda guardada cambia duración antes de reguardar. Se conserva la comprobación de cierre al aplicar/reabrir/releer, citas existentes y permiso del Doctor. Las pruebas previas de guardado programático marcan dirty explícitamente y consultan los estados convertidos a signals.

**Verificación local:** 176 pruebas aprobadas en seis archivos (Configuración, regresión P25, Calendario, asociación, disponibilidad y formulario de cita). Veintisiete casos nuevos cubren validaciones por Doctor/Asistente, formatos inválidos, duplicados/contención/medianoche, consecutivos sin reordenar, huecos y día completo, error oculto conservado y corrección por input/botón real, error cargado en otro día, pristine al navegar, duración vacía y edición silenciosa, bloqueo de petición duplicada/spinner. Compilación Angular de desarrollo correcta. Datos sintéticos y SDK/repositorios simulados; no valida reglas desplegadas ni dispositivos reales. Sin cuentas reales, capturas, migraciones o despliegue. La primera ejecución detectó expectativas antiguas de los tests sobre campos convertidos a signals y guardado pristine; se adaptaron sin eliminar la cobertura de permisos/persistencia.

Contextos Doctor, Asistente, compartido y proyecto actualizados con procedimiento, mensajes y capturas sugeridas desktop/mobile. **Límite:** son comprobaciones de este formulario; otros escritores o datos externos pueden seguir creando documentos inválidos. Los segmentos legacy sin ruta activa no se reactivan ni se migran. P26 no cambió la referencia horaria del navegador; P28 la implementó posteriormente.

### P27 — Texto del empty state del calendario móvil (9 de octubre de 2026)

Decisión aplicada: el mensaje del calendario móvil cuando el día seleccionado no tiene consultas pasó de «No tienes consultas agendadas para el día de hoy.» a «No tienes consultas agendadas para este día.», coherente con una fecha distinta a hoy. El calendario de escritorio no usa ese literal. No se modificaron datos, consultas, reglas ni configuración.

**Verificación local:** la prueba del calendario comprueba que el empty state contiene el texto nuevo y no el anterior (`calendar.spec.ts`). Compilación Angular de desarrollo y de producción correctas; datos sintéticos y repositorios simulados. Falta la comprobación visual tras despliegue.

### P28 — Hora del consultorio implementada (9 de octubre de 2026)

Implementación de la referencia definida en la sección anterior:

- `core/utils/clinic-time.ts` fija `CLINIC_TIME_ZONE = 'America/Mexico_City'` y deriva, a partir de un instante, el día civil (`YYYY-MM-DD`) y los minutos del día mediante `Intl.DateTimeFormat` con `hourCycle h23`. `todayClinicDateString` y `clinicTodayDate` exponen el día del consultorio; `clinicTodayDate` construye un `Date` local que solo representa el día civil elegido para los datepickers.
- `ClinicClockService` publica la hora del consultorio como señal `now`, con un temporizador que avanza al siguiente minuto y refresco al recuperar visibilidad/foco; limpia temporizador y listeners al destruir el inyector.
- `availability.ts` usa esa referencia para el día de hoy y las horas ya transcurridas: `futureSlotsForDate` e `isDateSelectable` comparan el día civil y los minutos del consultorio, no los del navegador, y descartan fechas anteriores. Las fechas elegidas y almacenadas siguen siendo civiles `YYYY-MM-DD`.
- El calendario (semana, día seleccionado, «Hoy», celda/hora actual), el formulario de cita de los tres roles (filtro del datepicker y horas disponibles, recalculadas al avanzar el reloj y al guardar) y la fecha de una entrada clínica nueva usan la hora del consultorio. La vigencia de recomendaciones/recetas del portal también.
- El adaptador de fechas de Material usa `clinicTodayDate` para «abrir hoy» sin desplazar el día.
- No cambian la fecha de nacimiento ni la duración de la sesión por inactividad. `appointments.ts` (código muerto sin ruta) era el último consumidor de `todayLocalDateString`; se eliminó posteriormente en P44.

**Verificación local:** pruebas nuevas `clinic-time.spec.ts` y `clinic-clock.service.spec.ts`, más casos P28 en el formulario de cita (guardar y conservar el día civil a través del cambio de día del dispositivo para Doctor/Asistente/Paciente, refresco del formulario abierto, rechazo de un día anterior y revalidación del datepicker al pasar la última hora) y ajustes en calendario, pacientes, historial clínico y vista de historial del paciente. Suite completa: **802 pruebas aprobadas en 66 archivos** y compilación Angular de producción correcta (solo avisos previos de presupuesto de SCSS y de `quill-delta` no ESM). Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** la revalidación del datepicker depende del refresco del reloj del consultorio (una vez por minuto o al reanudar la pestaña); no se fuerza una lectura externa. `appointments.ts` (código muerto) se eliminó en P44. Falta comprobar manualmente el comportamiento desde zonas horarias distintas y el cambio de día cerca de medianoche.

### P29 — Documento vigente por tipo en el portal del Paciente (9 de octubre de 2026)

Opción A aplicada: el portal conserva la lista ordenada de consultas (más reciente primero) y deriva dos selecciones independientes y reactivas al reloj del consultorio: la recomendación vigente más reciente y la receta vigente más reciente. Una receta anterior aún vigente se sigue mostrando aunque la última consulta solo aporte recomendaciones. Cada pestaña usa su propio documento, su propia vigencia (`visibleUntil`/`visibleUntilRx`) y su propia impresión. Si el documento más reciente de un tipo vence, la selección pasa al siguiente vigente del mismo tipo; si no queda ninguno de ese tipo, la pestaña desaparece y, si no queda ningún documento, se muestra el estado vacío.

**Verificación local:** se ampliaron las pruebas de la vista: dos consultas (antigua con receta vigente + nueva solo con recomendaciones) muestran ambas pestañas con el documento correcto por tipo, y al vencer la recomendación más reciente se cae a la anterior vigente. Suite completa: **804 pruebas aprobadas en 66 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** la selección sigue mostrando un documento por tipo (no reúne varias consultas); si se necesita historial completo de documentos vigentes, corresponde a la opción B no adoptada. La vigencia se evalúa con la hora del consultorio; un documento sin fecha de vigencia se considera siempre visible.

### P30 — Entrada clínica: siempre imprimir y fecha de hoy (9 de octubre de 2026)

Decisión explícita del usuario: **no** debe permitirse guardar una entrada clínica sin imprimir; el flujo siempre es para imprimir, y toda consulta se registra con la fecha del consultorio de hoy, sin fechas pasadas ni futuras. El comportamiento actual ya cumplía esta política, por lo que no hubo cambio funcional.

- El asistente de entrada nueva ofrece solo «Guardar e imprimir» (más «Anterior»/«Siguiente»); no existe un botón «Guardar» sin impresión. La edición «general» conserva su «Guardar» + «Guardar e imprimir», fuera del alcance de esta decisión.
- La fecha de la entrada nueva es la del consultorio (`todayClinicDateString`); no hay campo de fecha ni carga retrospectiva. En edición se conserva la fecha original.
- Si el popup de impresión está bloqueado, `saveAndPrint()` muestra «Permite ventanas emergentes para imprimir» y no guarda ni cierra el diálogo.

**Verificación local:** pruebas de regresión nuevas en `clinical-entry-dialog.spec.ts`: la entrada nueva solo muestra «Guardar e imprimir» (sin «Guardar») y, con popup bloqueado, `saveAndPrint()` alerta y no crea el registro ni cierra el diálogo; se conservan las pruebas P28 de la fecha del consultorio. Suite completa: **806 pruebas aprobadas en 66 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** confirmación de política, no cambio de funcionalidad. Falta la comprobación visual tras despliegue. El flujo de edición parcial («Guardar» sin imprimir) no se modificó.

### P31 — Medidas positivas y fecha de nacimiento no futura (9 de octubre de 2026)

Opción A aplicada (correcciones estructurales, sin rangos clínicos):

- Nuevo validador compartido `greaterThanZero` (`core/utils/validators.ts`): rechaza valores numéricos ≤ 0 y no se pronuncia ante un valor vacío o no numérico (esos los cubren `required`/`pattern`).
- **Entrada clínica** (`clinical-entry-dialog`): perímetro cefálico, peso, talla, saturación y temperatura exigen ahora un valor > 0, con mensaje «Ingresa un valor mayor a 0»; se mantienen el patrón numérico y el `required`.
- **Medidas al nacer** (`complete-profile-dialog`, `edit-patient-dialog`): peso, talla y perímetro cefálico exigen > 0; los mensajes ya indicaban «número positivo» y ahora coinciden con la validación; se añadió mensaje al perímetro cefálico (antes sin error visible). Se retiró el `Validators.min(0)` redundante.
- **Fecha de nacimiento**: los tres formularios (`complete-profile`, `edit-patient`, `new-patient`) usan `[max]="maxBirthDate"` (= hoy del consultorio, `clinicTodayDate`) y muestran «La fecha de nacimiento no puede ser futura»; el calendario deshabilita fechas futuras.
- Los rangos clínicos por campo (mín/máx) quedan para una fase B, a definir con el responsable clínico. No se migran datos existentes; la validación aplica a altas y ediciones nuevas.

**Verificación local:** unidad de `greaterThanZero` (casos cero/negativo/positivo/vacío/no numérico) y pruebas en los cuatro diálogos (cero rechazado en medidas; fecha futura marcada con `matDatepickerMax`). Suite completa: **820 pruebas aprobadas en 67 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** se validan fronteras (cero y fecha futura) sin rangos clínicos completos; falta la aprobación clínica de mín/máx por campo y la comprobación visual tras despliegue.

### P32 — Edición de contactos y vacuna anual (9 de octubre de 2026)

Decisiones del usuario:

- **Contactos al editar:** se permite retirar uno de los padres aunque se hayan cargado al inicio, pero debe quedar **al menos uno** (el niño no puede quedar sin enlace de padre/madre). Se añadió el validador de grupo `atLeastOneParent` (`core/utils/validators.ts`), aplicado al `FormGroup` de `edit-patient-dialog`, con el mensaje «Ingresa el nombre del padre o de la madre» cuando ambos quedan vacíos. El alta (`new-patient-dialog`) y completar perfil (`complete-profile-dialog`) siguen exigiendo ambos nombres. Los teléfonos/correos ya eran opcionales al editar y se mantienen así.
- **Vacuna Anual:** se mantiene una **sola marca** por vacuna, sin historial por año ni fecha de aplicación (opción B1).

**Verificación local:** unidad de `atLeastOneParent` (padre/madre/ambos/vacío/espacios) y prueba en `edit-patient-dialog.spec` (con ambos vacíos el grupo es inválido; con al menos uno vuelve a válido). Suite completa: **826 pruebas aprobadas en 67 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** el validador aplica a la edición; el alta sigue requiriendo ambos padres (decisión no revisada). No se migran datos. Falta la comprobación visual tras despliegue.

### P33 — Herencia del logo del Doctor en el encabezado (9 de octubre de 2026)

Opción A aplicada: el encabezado resuelve el logo del **Doctor propietario** para las sesiones que no son del propio Doctor:

- Doctor: usa su `logoPath`.
- Asistente: resuelve `createdBy` (uid del Doctor) y usa su `logoPath`.
- Paciente: resuelve `doctorId` y usa su `logoPath`.
- Admin o Doctor sin logo: logo de Lilcare (por defecto).
- La resolución es asíncrona por la misma ruta tolerante `resolveLogoUrl`; un cambio de logo del Doctor se refleja al cambiar la sesión o al reabrir, no en vivo.

Se cumple así el texto del registro del Doctor («sustituirá el logo de Lilcare en tu cuenta y la de los asistentes y pacientes que agregues»), que no se modificó.

**Verificación local:** pruebas del encabezado nuevas para Asistente (`createdBy`) y Paciente (`doctorId`) que comprueban la llamada a `UserRepository.getUser` y el logo resuelto; se conservan las pruebas del Doctor, home por rol y perfil. Suite completa: **828 pruebas aprobadas en 67 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** lectura extra al resolver el logo de Asistente/Paciente; el cambio de logo del Doctor no se refleja en vivo en esas sesiones hasta reabrir/relogin. Falta la comprobación visual con un logo real.

### P34 — "Logo precargado" efectivo en la impresión (9 de octubre de 2026)

Opción C aplicada: la elección entre marca Lilcare (logo precargado) y logo propio del Doctor se respeta en las tres rutas de impresión.

- `usePreloadedLogo = true` → se imprime el logo de Lilcare (`DEFAULT_LOGO_URL`); `false` → se imprime el `logoPath` del Doctor (con fallback a Lilcare si no hay logo).
- `print-preview` (`logoSource`), `patient-history.printSection` y el preview de `impresion` consultan el `PrintSettings` cargado.
- Persistencia coherente: subir un logo propio guarda `usePreloadedLogo: false`; eliminarlo guarda `true`; sin cambios se conserva el valor actual. Seleccionar un archivo marca `false` (usa el propio).
- Se mantiene `showLogo = true`; no cambian formatos, posición ni ancho.

**Verificación local:** prueba de `print-preview` (con `usePreloadedLogo` true usa el logo Lilcare y con false el del Doctor) y actualización de las pruebas de `impresion` (subir → `usePreloadedLogo: false`, eliminar → `true`). Suite completa: **829 pruebas aprobadas en 67 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** verificación de código y pruebas; falta comprobar la salida impresa real y el preview en navegador tras desplegar.

### P35 — Logo: formatos unificados y subida diferida (9 de octubre de 2026)

Opciones A1 + B1 aplicadas:

- **Formatos/tamaño unificados:** `FileUpload` acepta PNG/JPG/JPEG/SVG hasta 1 MB, igual que la pantalla de Impresión. Se actualizó el texto del registro del Doctor.
- **Subida diferida (B1):** `FileUpload` ya no sube al seleccionar; valida, guarda el archivo pendiente y emite `{ url: objectURL, path }` para previsualización. La subida real ocurre al guardar mediante `upload()`. `reset()` descarta la selección pendiente sin escribir.
- **Perfil:** guardar sube el archivo pendiente y usa su `path`; cancelar (`cancelEdit`) llama a `reset()` y no toca Storage. El logo del Doctor pasa a `usePreloadedLogo: false` al subir y `true` al eliminar (coherente con P34); sin cambios se conserva.
- **Setup-profile (modo existing):** guardar sube el pendiente; `usePreloadedLogo` queda `false` si hay logo y `true` si no. La invitación mantiene que el logo se configura desde Perfil tras iniciar sesión (P13).
- **Impresión** ya aceptaba PNG/JPG/SVG ≤ 1 MB; sin cambios.

**Verificación local:** spec nueva de `FileUpload` (no sube al seleccionar; `upload()` sube; acepta SVG; rechaza tipo/tamaño; `reset()` descarta) y actualización de las pruebas de `profile-dialog` (subir → `usePreloadedLogo: false`) e `impresion`. Suite completa: **835 pruebas aprobadas en 68 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** verificación de código y pruebas; falta la comprobación visual del flujo completo (seleccionar, cancelar, guardar) tras despliegue. La limpieza de objetos huérfanos previos no se aborda.

### P36 — Edad impresa a la fecha de la consulta (9 de octubre de 2026)

Opción A aplicada:

- `print-preview` calcula la edad con la fecha del registro (`calcAgeAtDate(birthDate, record.date)`), no con la fecha actual.
- `patient-history.printSection()` usa la misma base (fecha de la consulta).
- Se alineó el fallback de logo del historial a `DEFAULT_LOGO_URL` (antes `/images/Logo.jpg` literal).
- No se unifica el pipeline de impresión (opción B) ni se cambian márgenes, paginación o formato; se conservan las rutas con `PrintSettings`.

**Verificación local:** prueba de `print-preview` que con consulta del 15/01/2022 y nacimiento 15/01/2020 calcula «2 años» (no la edad actual) y muestra la fecha 15/01/2022. Suite completa: **836 pruebas aprobadas en 68 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** persisten varios caminos de impresión (el portal del Paciente no muestra edad ni logo; las gráficas tampoco). Unificarlos (opción B) queda como mejora opcional. Falta comprobar las salidas impresas reales.

### P37 — Gráficas de crecimiento: se mantienen visibles (9 de octubre de 2026)

Decisión del usuario: mantener la pestaña «Gráficas» visible, con la calibración oculta (`environment.calibration_enabled=false`), a reserva de la aprobación clínica externa. No hubo cambio funcional.

- El repositorio no puede certificar clínicamente el esquema ni las gráficas; la aprobación corresponde al responsable clínico.
- La herramienta de calibración permanece oculta hasta habilitar su flag; no se documenta calibración ni interpretación en los manuales sin aprobación.
- Sin cambios de código, configuración ni datos; decisión de producto (sin pruebas nuevas).

### P38 — Notificaciones del Paciente en móvil (9 de octubre de 2026)

Opción A aplicada:

- Nueva ruta **`/paciente/notificaciones`** bajo el layout del portal (`authGuard` + `patientGuard`), que reutiliza `NotificationsPage` (`<app-notifications-dialog [asPage]="true">`).
- `NotificationBell` ahora es consciente del rol: con sesión de Paciente navega a `/paciente/notificaciones`; con personal, a `/app/notificaciones`. La detección de vista activa usa la ruta correspondiente.
- En desktop se mantiene la apertura del `NotificationsDialog` (sin guard), que ya funcionaba para el Paciente.
- El segundo click estando en la ruta vuelve atrás (igual que en personal).

**Verificación local:** prueba de `notification-bell` nueva para sesión de Paciente en móvil (navega a `/paciente/notificaciones` y no abre el diálogo); se conserva la de personal (`/app/notificaciones`). Suite completa: **837 pruebas aprobadas en 68 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** falta la comprobación visual en el portal móvil; «Ver detalles» dentro de las notificaciones del Paciente se trata en P39.

### P39 — "Ver detalles" de notificaciones por rol (9 de octubre de 2026)

Opción A aplicada:

- `openDetails` navega al **calendario del rol**: Paciente → `/paciente/calendario`; Doctor/Asistente → `/app/calendar`, conservando el foco de la cita.
- `close()` en modo página navega al mismo calendario del rol (antes `/app/calendar` fijo).
- La notificación se marca leída cuando el destino es válido para el rol; con el destino corregido, el Paciente ya puede abrir el detalle sin rebote.

**Verificación local:** prueba del diálogo para sesión de Paciente («Ver detalles» → `/paciente/calendario`, no `/app/calendar`) y regresiones de personal (`/app/calendar`). Suite completa: **838 pruebas aprobadas en 68 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** falta la comprobación visual con el tutor; no se cambia el contenido del detalle de la cita ni el foco.

### P40 — Destinatarios familiares acotados al Doctor (9 de octubre de 2026)

Opción A aplicada:

- `addPatientFamily` ahora incluye solo a los hermanos cuyo `doctorId` coincide con el del paciente de la cita; los registros familiares de otros Doctores quedan fuera.
- Alinea los destinatarios de avisos con el grupo visible del portal (`getChildrenGroup(email, doctorId)`).

**Contexto de dominio (aportado por el usuario):** un mismo padre/hijo puede tener **varios expedientes con distintos Doctores**, compartiendo incluso el correo de acceso, pero **cada expediente tiene su propia contraseña** (el correo no unifica registros). Por eso la agrupación y los destinatarios se acotan por Doctor.

**Verificación local:** prueba del servicio: con un mismo correo y hermanos bajo dos Doctores, se notifica solo a los del Doctor de la cita (`p1`, `p2`) y no al de otro Doctor (`p3`). Suite completa: **839 pruebas aprobadas en 68 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** la consulta `findPatientsByLoginEmail` sigue trayendo registros de todos los Doctores y el filtrado es en cliente; falta comprobar con dos consultorios reales.

### P41 — Copia del actor leída y canceladas al cerrar (9 de octubre de 2026)

Decisiones del usuario:

- **1A — Canceladas al cerrar:** se mantiene que cerrar/abandonar el centro marque como leídas todas las `appointment-cancelled` no leídas, incluidas las no cargadas (`markAllCancelledRead`). Sin cambio.
- **2B — Copia del actor:** la notificación de quien realiza la operación se crea con `read: true`, de modo que no cuenta en su badge pero queda como registro; el resto de destinatarios sigue `read: false`. Implementado con `NotificationRecipient.read` opcional y `createMany` usando `recipient.read ?? false`; `persist` marca la copia del actor (`currentActor`) como leída.

**Verificación local:** prueba del servicio (la copia del Doctor actor queda `read: true`; el resto no). Se conservan las pruebas de canceladas al cerrar (sin cambio). Suite completa: **840 pruebas aprobadas en 68 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** falta comprobación visual; el badge depende de la suscripción en vivo a no leídas.

### P42 — Estados de error y reintento en el portal (9 de octubre de 2026)

Opción A aplicada:

- `patient-patients`: nuevo estado `error`; ante fallo muestra «No fue posible cargar tus pacientes. Intenta nuevamente.» con botón **Reintentar** (`load()`), en lugar de la lista vacía.
- `patient-history-view`: `ngOnInit` delega en `load()` con `try/catch`; ante fallo o `!patientId` muestra «No fue posible cargar el historial. Intenta nuevamente.» con **Reintentar**, y `loading` queda en `false` (sin spinner infinito). Se añadió `MatButtonModule`.
- Ambas usan un guard de inicialización para no recargar en detecciones posteriores.

**Verificación local:** pruebas nuevas en ambas vistas (fallo → estado de error + `loading=false`; reintento → vuelve a cargar). Suite completa: **842 pruebas aprobadas en 69 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** falta comprobación visual en el portal; no se cambian consultas ni permisos.

### P43 — Avisos de popup bloqueado y fallos de cancelación (9 de octubre de 2026)

Opción A aplicada:

- `patient-history-view.print()`: inyecta `AlertService`; si `window.open` es nulo (popup bloqueado) muestra «Permite ventanas emergentes para imprimir» (coherente con los demás caminos de impresión).
- `calendar`: `doCancelAppointment` y `deleteAppointment` envueltos en `try/catch`; en caso de fallo muestran `alert.error` («No fue posible cancelar la consulta…» / «No fue posible eliminar la consulta…») y **no** la alerta de éxito.

**Verificación local:** prueba del portal (popup bloqueado → alerta) y del calendario (fallo al cancelar → error y sin éxito). Suite completa: **844 pruebas aprobadas en 69 archivos** y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** falta comprobación visual; no se cambia el flujo de confirmación ni la lógica de datos.

### P44 — Limpieza de código muerto y Bitácora del Admin (9 de octubre de 2026)

Decisión del usuario: eliminar el código muerto y **conservar la Bitácora** agregándola a la vista del Admin como su último elemento.

- Eliminados: páginas `dashboard` y `appointments` (walk-in) con sus diálogos y specs, y las redirecciones `dashboard`/`appointments` de `app.routes.ts`. El selector de Doctor del calendario (`@if(false)`), su handler y `MatSelectModule` también se retiraron.
- **Bitácora:** se conserva la página `audit-log` y se añade la ruta **`/app/audit-log`** (hijo de `/app`, `roleGuard(['admin'])`) para el Admin. Se confirmó que los registros **sí** se generan hoy: calendario (eliminar cita), pacientes (alta/edición/desactivación) y configuración usan `AuditRepository.log`.
- **Navegación del Admin:** el sidebar ahora se muestra para Doctor y Admin; para el Admin tiene **Doctores** y **Bitácora** (última). El Doctor conserva Calendario/Pacientes/Asistentes/Impresión.
- `AuditRepository` se conserva (lo usan varias pantallas).

**Verificación local:** pruebas del sidebar (Admin → Doctores + Bitácora última; Doctor sin Bitácora; Asistente sin items) y de rutas (Admin entra a `/app/audit-log`; Doctor/Asistente son redirigidos a login). Suite completa: **830 pruebas aprobadas en 67 archivos** (baja por eliminar 2 specs de código muerto) y compilación Angular de producción correcta. Datos sintéticos y servicios simulados; sin cuentas reales ni despliegue.

**Límite:** la Bitácora es de solo lectura y admin-only; falta comprobación visual y pulido de la tabla si se requiere. No se cambian las reglas de Firestore.

### P45 — Cierre local y excepción de pruebas confirmada

Implementación UI + invitación + seguridad completada con las decisiones aprobadas. Admin mantiene Doctores como entrada y dispone de Doctores → Administradores → Bitácora. Solo Admin incorpora Admin/Doctor; Admin/Doctor pueden crear Asistentes en backend. **Respuesta explícita del usuario:** el Asistente creado por Admin queda asociado al Admin para pruebas, sin agenda hasta vincularlo a un Doctor válido. No existe UI administrativa de alta de Asistente o reasignación.

Invitar/reemitir/registrar conserva el rol administrativo; editar otro Admin permite nombre/correo mediante servidor y conserva sesión del operador. Perfil propio sigue solo correo. Baja propia prohibida; una reserva transaccional exige otro Admin con perfil completo, principal activo y sin baja en curso. Pendientes no cuentan. Eliminar Admin no borra Doctores que incorporó ni sus expedientes; la Bitácora se conserva.

**Verificación actual:** Angular **845/845 pruebas, 68 archivos**; Node P01/P04/P09/P13/P45 **223/223**, más **8/8** del protocolo del Paciente; reglas/transacciones en Firestore Emulator aislado **46/46**. Compilación Functions y Angular producción correctas. Lint Functions sin errores, tres avisos de tipos previos; build Angular conserva avisos de SCSS del calendario/Quill. `git diff --check` sin errores. Sin datos reales, cambios de flags/configuración, migraciones ni despliegue.

**Activación:** conserva dependencia P01. El directorio todavía usa `users` global y el prototipo permite perfiles propios/proyecciones mínimas: hay que integrar lectores y escritores de P01 antes de activar, no desplegar únicamente las reglas. Ver [análisis y evidencia P45](security/p45/ANALISIS_Y_VERIFICACION.md) y [auditoría específica del prototipo](security/p45/SECURITY_RULES_AUDIT.json).

## Segunda revisión de cierres — código actual del 9 de octubre de 2026

Revisión de decisiones, fuentes de los flujos y pruebas actuales; no una certificación visual ni de producción. Se conservaron los cambios previos de la otra IA y no se corrigieron automáticamente las observaciones nuevas. Las pruebas aprobadas confirman sus casos explícitos, no todos los escenarios de cada pantalla.

| Punto(s) | Resultado de esta revisión | Evidencia principal / límite |
|---|---|---|
| P01 | **Sigue abierto** | Prototipo y pruebas preparados; login del Paciente aún local, reglas/cliente no integrados. No inspección remota nueva ni despliegue en esta revisión |
| P02–P03 | Cierre local conservado | Rutas/impresión por propietario, consultas por Doctor y pruebas de alcance actuales; confidencialidad de solicitudes directas depende de P01 |
| P04–P05 | Servidor local conservado; no activado | Regresión de baja/cascada/reintentos pasa; protección de escritores/Storage/portal pendiente de P01 |
| P06–P08 | Restricciones locales conservadas | Pruebas de asociación y configuración; Asistente puede horarios sin toggle del Paciente; Admin propio solo correo, Asistente nombre/correo. P45 amplía gestión ajena sin alterar perfil propio |
| P09–P10 | Preparado, no activado | Editor y backend de correo aprobados; P45 añade destino Admin. Falta Auth/Firestore/cliente integrados y validación real |
| P11 | Textos por rol conservados | Doctor/Asistente y nuevo Admin tienen advertencias distintas; pruebas de confirmación pasan |
| P12–P13 | Flujo local conservado; no activado | Pruebas de estado/reintento, duplicados, capacidad de un uso y siete días; correos reales/servicio integrado pendientes |
| P14 | Cierre local conservado | Guards/rutas/login probados; Admin entra Doctores, Doctor/Asistente Calendario |
| P15–P17 | Cierre local conservado para Paciente | Perfil separado, salida a Acceso paciente y pruebas de inactividad/recarga; protección e invalidación remotas permanecen en P01 |
| P18–P21 | Cierre local conservado | Pruebas actuales de reagenda móvil, cancelada libre, exclusión por ID propio, limpieza/validación de Hora |
| P22 | Decisión conservada | No se reabre el riesgo aceptado ni se añade reserva atómica de citas; tiempo real no se presenta como garantía de exclusión |
| P23–P24 | Cierre local conservado | Pruebas de confirmaciones separadas, texto/selección y alta embebida |
| P25–P27 | Cierre local conservado | Regresión de semana cerrada, segmentos inválidos y texto del día seleccionado pasa |
| P28 | Referencia central conservada; revisar variante adicional | Reloj/disponibilidad/calendario/fechas civiles probados; posible variante de vigencia clínica abierta durante medianoche en P52 |
| P29 | Selección por tipo conservada; falta desempate | Pruebas de receta anterior vigente y vencimiento pasan. Dos consultas del mismo día: P48 |
| P30 | Decisión conservada | UI Guardar e imprimir y fecha del consultorio; popup bloqueado detiene la operación. Editar conserva fecha original; método `save()` preparado sin botón normal no se enseña como guardar sin imprimir |
| P31–P32 | Cierre local conservado | Validadores >0 y padre/madre al editar probados; rangos clínicos externos siguen pendientes; marca Anual única por decisión |
| P33 | Herencia local conservada; falta variante de error | Pruebas de logo del propietario pasan; lectura fallida del propietario: P49 |
| P34–P35 | Selección/subida diferida conservadas; falta recuperación completa | PNG/JPG/SVG ≤1 MB, subida al guardar y flags probados; fallo posterior a upload: P50 |
| P36 | Cierre local conservado | Impresión calcula edad a fecha de consulta; salidas reales requieren comprobación |
| P37 | Decisión conservada; validación clínica externa abierta | No se certifican clínicamente curvas/vacunas; no se modifica configuración ni se reabre la decisión de mantener gráficas |
| P38–P41 | Cierre local conservado | Ruta Paciente móvil, detalles al calendario por rol, familia acotada y copia del actor leída probados; contextos desactualizados en P46 |
| P42–P43 | Cierre local conservado | Pruebas de carga/error/reintento, popup y cancelación fallida pasan |
| P44 | Cierre local conservado; revisar Bitácora | Archivos/rutas muertos retirados; Bitácora admin-only al final del menú. Sus errores/teardown: P51 |
| P45 | Implementado y probado localmente; no activado | Directorios, permisos y baja concurrente verificados; activación coordinada con P01 permanece pendiente |

## Observaciones nuevas de la segunda revisión — para tratar una por una

Esta tabla registra el hallazgo original; los avances y estados posteriores se detallan al final. No sustituye ni reabre las decisiones explícitas P22, P25, P30, P32 y P37. **Siete entradas nuevas**; algunas requerían reproducción/decisión, no eran siete fallos confirmados en producción. Se agregan a P01 y a las validaciones visuales/activación ya registradas.

| ID | Certeza / relación | Observación y efecto | Verificación / opciones de revisión | Fuentes |
|---|---|---|---|---|
| P46 | **CONFIRMADO — documentación desactualizada** | Contextos antiguos todavía contradicen cambios P29–P44: Paciente describe una consulta global y ausencia de procedimiento de notificaciones; shared conserva Paciente sin avisos; PROJECT describe Admin sin sidebar y archivos/rutas retirados. Admin/shared se actualizaron para P45, pero no se rehízo toda la documentación anterior. No usar los documentos completos como fuente final vigente todavía. | Sincronizar los cinco contextos y PROJECT contra el código aprobado, conservando certeza/flags; revisar preguntas y screenshots para eliminar referencias obsoletas. No necesita cambiar comportamiento ni decidir otra política. | `PATIENT_OPERATIONS_CONTEXT.md` 5.5/13, `SHARED_OPERATIONS_CONTEXT.md` matriz, `PROJECT_OPERATIONS_CONTEXT.md` roles/rutas; `patient-history-view.ts`, `notification-bell.ts`, `app.routes.ts` |
| P47 | **CONFIRMADO — preferencia signals no aplicada globalmente** | Persisten funciones/getters/propiedades ordinarias en presentación: `age(p)`, `parentsDisplay(p)`, `formatCivilDate(...)` en portal; `step`, `saving`, `isEdit`, `stepLabel` en entrada clínica; `displayedColumns` y `substring` en Bitácora. P45 usa signals/computed, pero eso no significa cumplimiento en el resto del proyecto. No se corrigió por tratarse de revisión. | Delimitar un recorrido por componentes para pasar presentación a signals/computed y mantener eventos/formularios; verificar errores/read-only/móvil sin refactor funcional. No confundir llamadas a signals con métodos de presentación, ni controles/variables locales de `@for` con fuentes de estado nuevas. | `pages/patient-history-view/`, `pages/patient-history/dialogs/clinical-entry-dialog/`, `pages/audit-log/` |
| P48 | **CONFIRMADO en ordenamiento / decisión pendiente — P29** | «Más reciente» solo compara `date` día civil. Dos registros vigentes del mismo tipo creados el mismo día empatan; el portal conserva el orden recibido de la consulta, sin usar `createdAt`/`updatedAt`. P30 impone fecha de hoy a nuevas entradas, por lo que el empate es posible en registros nuevos. No puede afirmarse cuál documento prevalece dentro del día. | Decidir si prima la última creación o última edición; reproducir con dos documentos sintéticos del mismo día y orden de respuesta invertido. No requiere migrar datos antiguos. | `patient-history-view.ts` (`load`, selección por tipo), `core/repositories/clinical-record.repository.ts` (`getByPatient`), `core/models/clinical-record.ts` |
| P49 | **CONFIRMADO: cadena sin recuperación / efecto visible REQUIERE VALIDACIÓN — P33** | Heredar logo depende de `getUser` para Asistente/Paciente. Si esa lectura rechaza, el Promise entra en `from`/`switchMap` sin `catch`; el fallback Lilcare solo cubre perfil ausente/sin logo, no ese rechazo. `toSignal` puede quedar en error y afectar el render del encabezado, además de no recuperar futuras emisiones. | Probar fallo de permisos/red al resolver propietario y posterior cambio de sesión. Opción de corrección para revisar: fallback Lilcare por fallo, con suscripción capaz de recuperarse. No cambiar pertenencia ni mostrar logos ajenos. | `shared/components/header/header.ts` (`ownerLogoPath`, `resolveHeaderLogo`, `logoUrl`) |
| P50 | **CONFIRMADO en secuencia y borrador / efecto visual REQUIERE VALIDACIÓN — P34/P35** | Subida de `FileUpload` exitosa borra pendiente/revoca object URL, pero Perfil no reemplaza `logoUpload` con el resultado definitivo hasta cerrar el guardado. Si luego falla `updateUser`/ajustes, reintentar sin pendiente reutiliza la URL blob anterior como preview. Además upload → perfil → ajustes son operaciones separadas sin rollback; un fallo posterior puede dejar logo/flag ya persistidos parcialmente. Los tests actuales cubren selección/cancelación y éxito, no ese recorrido completo. | Reproducir upload correcto + fallo de perfil/ajustes + reintento/cancelación. Revisar conservar resultado definitivo para reintentos y comunicar/recuperar guardado parcial; no prometer que cancelar revierte un upload ya confirmado. | `shared/components/file-upload/file-upload.ts` (`upload`, `clearPending`), `shared/components/profile-dialog/profile-dialog.ts` (`save`), `pages/impresion/impresion.ts` (`save`) |
| P51 | **CONFIRMADO por código — P44/Bitácora** | `AuditLog.ngOnInit` abre `watchAll().subscribe` sin teardown al destruir la página. Reentrar puede acumular listeners. El repositorio no conecta callback de error de `onSnapshot` con el Observable y la vista no tiene estado de error/reintento; fallos pueden dejar carga indefinida. La lista solo trae 200 registros sin paginación (límite funcional documentado, no un fallo por sí solo). | Verificar entrar/salir repetidamente y lectura rechazada. Revisar teardown y estados loading/error/vacío; decidir aparte si hace falta paginación. No atribuir trazabilidad completa a todas las acciones: emisión actual no cubre automáticamente cada operación. | `pages/audit-log/audit-log.ts`, `core/repositories/audit.repository.ts`, `pages/audit-log/audit-log.html` |
| P52 | **POSIBLE / REQUIERE REPRODUCCIÓN — variante P28** | `noPastDates` clínico crea un callback nuevo al avanzar el reloj, pero tanto el callback viejo como el nuevo consultan `todayClinicDateString()` al ejecutarse. Material revalida el input al cambiar el filtro solo si cambia el resultado viejo/nuevo para el valor seleccionado. Ambos pueden evaluar ya el nuevo día y no disparar esa validación. Una nueva entrada dejada abierta durante medianoche con vigencia de ayer podría seguir pasando `form.invalid`; el guardado no compara de nuevo esa vigencia con hoy. La reserva de citas ya captura el reloj en el filtro, esta variante está en la entrada clínica. | Reproducir con datepickers reales: nueva entrada, vigencia hoy, salto de medianoche central, intento de guardar. Si se confirma, capturar día en el filtro y/o revalidar al guardar; mantener la política distinta de edición existente. No declarar fallo clínico reproducido solo por este análisis. | `pages/patient-history/dialogs/clinical-entry-dialog/clinical-entry-dialog.ts` (`noPastDates`, `saveAndPrint`), `.html`, setter `dateFilter` de Material instalado |

## Avance posterior — decisiones y regresiones verificadas

### P01 — EN PROCESO; primera parte del servidor implementada

`functions/src/clinic-auth.ts` implementa autenticación de pacientes con verificador scrypt, limitación transaccional de intentos, comprobaciones actuales de propietario/autoridad, membresías familiares y token personalizado. `getClinicSession` vuelve a verificar identidad y vinculación; un Asistente de pruebas ligado a Admin no obtiene una agenda. La activación queda **false** y el cliente productivo todavía no usa este protocolo. No se alteraron las reglas raíz, no se creó un secreto y no se desplegó.

La integración **no está completa**. Se mantiene P01 abierto: faltan los escritores/proyecciones y consultas del cliente, revocación por cambios de credenciales, ciclo de inactividad del nuevo acceso, correo/auditoría/notificaciones confiables, Storage, reglas compatibles, bootstrap y ensayo integrado. El detalle concreto está en [AVANCE_INTEGRACION.md](security/p01/AVANCE_INTEGRACION.md).

### P48 — RESUELTO LOCALMENTE con la última decisión del usuario

Decisiones confirmadas:

- En empate de día, prima **la última creación**; una edición no desplaza a un documento creado después.
- Si dos documentos siguen activos y el paciente conserva acceso, **debe poder consultar ambos**. Se muestran todos los vigentes del niño autorizado, separados en Recomendaciones y Receta; no se limita la selección a uno por tipo.

Implementado: orden por día de consulta descendente y creación original descendente con precisión de Timestamp; ID estable únicamente como desempate cuando no existe cronología suficiente. No se usa `updatedAt`. Cada entrada tiene fecha, vigencia y botón de impresión propio. Un vencimiento retira únicamente el documento afectado; vacío sigue mostrando el mensaje habitual. Impresión elige el ID del documento vigente, rechaza IDs ausentes/vencidos y sanea contenido antes de escribir en la ventana. Presentación mediante signals/computed; la comprobación familiar actual se conserva y su protección de servidor sigue dentro de P01.

**Verificación:** diez pruebas del portal, incluyendo orden de respuesta invertido, dos documentos del mismo día, edición posterior de uno anterior, ambos tipos, impresión del documento anterior, vencimiento durante medianoche y niño ajeno. Contextos Paciente/shared/PROJECT actualizados para esta decisión, con screenshots de múltiples documentos en desktop/mobile. No certifica una impresión física ni corrige por sí solo toda la documentación de P46.

### P47 — AVANCE LOCAL; revisión global pendiente

Portal: edad, tutores, fechas y entradas visibles provienen de computed/signals. Entrada clínica: título, edad mostrada, paso, pestaña, guardado, errores enviados y contexto usan signals/computed. Bitácora: columnas e ID abreviado se calculan antes de la presentación. Eventos y referencias de Reactive Forms se conservan.

Esto resuelve los ejemplos identificados en esos tres componentes, **no acredita cumplimiento en todos los templates**. P47 sigue abierto para completar el recorrido global; P46 conserva pendiente la sincronización completa de los documentos.

### P49 — RESUELTO LOCALMENTE

Una lectura fallida del propietario recupera el logo Lilcare dentro de la emisión actual sin terminar la suscripción. Un cambio de sesión limpia inmediatamente el logo anterior y puede cargar después el logo del nuevo propietario. Probado para Asistente y Paciente con fallo seguido de cambio de sesión y logout. No amplía permisos de lectura ni cambia pertenencia.

### P50 — RESUELTO LOCALMENTE; activación de permisos dentro de P01

Perfil conserva inmediatamente el resultado definitivo de la subida, sin reutilizar el object URL revocado. Logo, datos profesionales y preferencia de impresión se guardan con **un único update del mismo documento**; Impresión guarda logo y configuración del mismo modo. Reintentar después de una lectura/guardado de metadatos fallido reutiliza la subida confirmada, sin otro upload.

Cada selección usa un nombre de objeto con UUID independiente, conservado durante su reintento; repetir el nombre del archivo no sobrescribe el logo anterior antes de guardar el perfil. El nombre presentado en Perfil omite ese prefijo. Las alertas distinguen el fallo con logo ya subido y permiten reintentar; el perfil/configuración anterior sigue sin modificarse si falla el commit. Cancelar descarta el borrador y vuelve a referencias guardadas; **no borra ni revierte un objeto ya subido**. Puede quedar un objeto sin referencia; la limpieza/retención de Storage no se presenta como implementada.

**Verificación:** regresiones de upload correcto + fallo de perfil, fallo de lectura de settings y reintento; subida única en Impresión; mismo nombre con dos objetos distintos; eliminación de referencia y flags en un commit. Mantiene PNG/JPG/JPEG/SVG y máximo 1 MB. No se desplegaron reglas/Storage ni se tocaron archivos de usuarios reales.

### P51 — RESUELTO LOCALMENTE

Listener se libera al salir/reentrar y al reintentar. El repositorio propaga errores de snapshot; la pantalla sale de carga, muestra «No fue posible cargar la bitácora. Intenta nuevamente.» y Reintentar. El vacío solo aparece después de una lectura correcta mediante la fila vacía de Material. Pruebas de ciclo, permiso fallido, reintento, reemplazo de listener y datos calculados. Conserva límite de 200 registros y cobertura selectiva de auditoría; no añade paginación ni garantiza auditoría de todas las acciones.

### P52 — CONFIRMADO EN REGRESIÓN y RESUELTO LOCALMENTE

Se ejecutó la prueba con datepicker real y reloj central pasando de 23:59 a 00:00. Restaurar temporalmente **solo el filtro anterior** produjo el fallo esperado (no aparecía `matDatepickerFilter`); el archivo corregido se restauró íntegro al terminar el diagnóstico. El filtro ahora captura el día del consultorio en cada callback. Guardar/Guardar e imprimir vuelven a comprobar vigencias antes de abrir popup o persistir, incluso sin un render intermedio. La edición existente conserva permiso de fechas anteriores.

**Evidencia conjunta:** Angular **866/866, 70 archivos**; Node **239/239**; Firestore Emulator aislado **57/57** (reglas/transacciones previas más once casos nuevos de autoridad/login). Functions compila; lint sin errores y conserva tres advertencias previas. Build de producción Angular correcto con los avisos SCSS/Quill ya registrados. Datos sintéticos, sin cuentas reales, migraciones, borrados de datos antiguos ni despliegue. P01, P46 y el recorrido global de P47 permanecen abiertos; las validaciones visuales/ambiente definitivo no se dieron por realizadas.

### P01 — SEGUNDA PARTE LOCAL: credenciales de pacientes y renovación

**Estado: EN PROCESO; no cerrado, no activado y no desplegado.** Continúa el primer pendiente abierto. Las decisiones y preguntas vigentes se encuentran en el índice consolidado al inicio; ese índice prevalece sobre propuestas anteriores.

**Implementado y confirmado en código/pruebas:** `functions/src/patient-credentials.ts` prepara generación de contraseña de seis caracteres, consulta y renovación autorizadas exclusivamente al Doctor propietario. Por la decisión posterior del usuario, ya no admite contraseña elegida por el Doctor/cliente: solo generación en servidor, sin vencimiento. Login compara un verificador scrypt; la copia para consultar/copiar se conserva cifrada con AES-256-GCM en una ruta privada de servidor. Se declaran nombres de secretos, sin provisionar ni copiar valores.

La renovación guarda credencial, recibo idempotente y auditoría mínima en una transacción. Dos reintentos de la misma operación no producen dos contraseñas, y operaciones distintas con revisión antigua no se sobrescriben. Los principales del login nuevo quedan ligados a la revisión e identidad de creación de su credencial: el servidor rechaza todos los dispositivos autenticados mediante la credencial anterior; borrarla/recrearla no revive esas sesiones. La contraseña de otro hijo no se renueva automáticamente. El helper de cambio de correos conserva la contraseña, cambia los alias/revisión y está preparado para un guardado atómico con el paciente. Bajas en curso impiden login y gestión del acceso. El adaptador Angular transmite solo campos permitidos, valida respuesta y no tiene fallback directo a Firestore.

**Pendiente confirmado de integración:** alta/edición/baja, regeneración y login siguen usando el flujo anterior. La consulta de contraseña sí se conectó posteriormente al adaptador protegido, sin lectura alternativa del campo antiguo; este botón requiere la activación coordinada para funcionar y no debe publicarse por separado. Las reglas actuales/prototipo no incorporan aún la comparación de revisión para todas las lecturas ni completan los permisos del sistema. Por tanto, esta parte no garantiza revocación en producción ni cierre visual inmediato de una sesión abierta. Falta integrar la hora de inactividad con el Auth nuevo, el correo autorizado, los escritores/proyecciones/reglas y la activación coordinada de P01. No sustituir aisladamente las reglas ni habilitar estos endpoints por separado.

**Mantenimiento todavía no implementado:** reenvoltura/lectura por versiones al rotar la clave de cifrado; retención/limpieza de recibos, principales y membresías. Cambiar el secreto sin preparar las credenciales haría fallar su recuperación. No se migraron ni borraron datos antiguos.

**Verificación de esa etapa, anterior a la decisión de contraseñas exclusivamente generadas:** Angular **877/877, 71 archivos**; Node **246/246**; Firestore Emulator aislado **71/71**, incluidos catorce casos nuevos de credenciales, con Auth simulado y datos sintéticos. Functions compila; lint sin errores, con las tres advertencias previas. `git diff --check HEAD` sin errores. Estos totales no certifican automáticamente los cambios posteriores. El emulador no comprueba Secret Manager, el transporte callable real, Auth ni SMTP desplegados. No se cambió ningún entorno ni regla raíz, no hubo despliegue.

Fuentes/evidencia: `functions/src/clinic-auth.ts`, `functions/src/patient-credentials.ts`, `src/app/core/services/patient-access.service.ts`, `security/p01/patient-credentials.spec.mjs`, `security/p01/patient-credentials.emulator.spec.mjs`, `src/app/core/services/patient-access.service.spec.ts`. Registro: [avance de P01](security/p01/AVANCE_INTEGRACION.md) y [contratos de credenciales](security/p01/INTEGRACION_CREDENCIALES.md). P46 y el recorrido global de P47 también continúan abiertos.

### P01 — Ajustes posteriores a las decisiones de acceso y alta

- Servidor: generación criptográfica únicamente; el contrato de renovación rechaza una contraseña aportada por el cliente. Reserva de huella privada global y credencial se crean en la misma transacción; una colisión regenera el candidato y no modifica otro expediente. Se libera la huella anterior al renovar, **coherente con D01 A: unicidad entre contraseñas activas y reutilización posterior permitida**. Completar esa liberación al integrar bajas. No confundir estas reservas de contraseñas con reservas atómicas de citas, descartadas en P22.
- UI de Doctor: menú ofrece Ver contraseña y Regenerar. Ver contraseña usa el servicio protegido, solo lectura/copiar y reintento; se retiró la edición manual. Respuestas de una consulta cerrada o de otro paciente no reaparecen en pantalla. Regenerar todavía debe conectarse al servidor nuevo.
- Alta por Asistente: se retiró la contraseña del mensaje de éxito. **Esto solo cambia el mensaje**: el flujo cliente anterior todavía genera/escribe la contraseña, por lo que no garantiza su aislamiento frente al Asistente. No considerar completada esa política hasta conectar el alta protegida y eliminar el flujo anterior.
- Alta protegida preparada: `functions/src/clinic-patients.ts` verifica el Doctor/Asistente autorizado, deriva propietario en servidor, valida datos básicos y devuelve avisos separados de correo/nombre duplicados. Creación idempotente de paciente, directorio mínimo, resumen del portal, credencial privada, reserva de contraseña y auditoría en una transacción. No devuelve contraseña a ningún creador. No está conectada al formulario y **aún no envía correo**. D02/D03 ya decididas: ambos correos sin duplicados y reintento por Asistente exclusivamente de su alta, sin consultar contraseña. Implementación/integración pendientes.
- Cancelación del Paciente: además del botón oculto, el handler comprueba la prohibición antes de abrir confirmación y antes de guardar. La protección final de la escritura debe quedar integrada en P01.
- Los secretos `PATIENT_CREDENTIAL_ENCRYPTION_KEY` y `PATIENT_PASSWORD_UNIQUENESS_KEY` son únicamente nombres declarados. Sin valores provisionados, despliegue, cambios de cuentas reales ni modificación de las reglas raíz.

Verificación parcial posterior: **112/112 pruebas Angular en cinco archivos** para consulta de acceso, adaptador, alta, calendario y pacientes; **12/12 pruebas Node** de credenciales/alta. **79/79 pruebas Firestore Emulator** de reglas, gestión de Admin, Auth/credenciales y alta protegida; incluye colisiones entre Doctores, reintentos paralelos, confirmación de duplicados y alta por Asistente sin devolver contraseña. Functions compila; los módulos nuevos pasan lint. `git diff --check HEAD` sin errores de espacios. No sustituye una prueba completa de aplicación + proveedor Auth + correo + permisos desplegados.

### P01 — INTEGRACIÓN LOCAL COMPLETADA; publicación aún pendiente (10 de octubre de 2026)

Este estado prevalece sobre las descripciones históricas de cliente anterior/prototipo sin integrar. **No equivale a activación ni cierre en producción.** No se han creado/modificado cuentas reales, leído datos clínicos, provisionado valores de secretos, enviado SMTP real ni desplegado estos cambios.

**CONFIRMADO en código y pruebas locales:**

- Login personal conserva UID/cuenta/contraseña; validación de autoridad y sesión de dispositivo del servidor. Paciente canjea token personalizado, deja de depender de autenticación local y obtiene familia acotada al Doctor/contactos actuales.
- Una hora máxima de inactividad para cuatro roles; revisión al recargar/reanudar, sin revivir sesión vencida ni expirar contraseña. Metadata propia permite cierre visual al cambiar revisión/rol/estado; respuestas tardías de otra sesión se descartan.
- Alta/edición/baja de pacientes, clínica, citas, horarios/perfil migrados a operaciones confiables; queries/listeners mínimos por propietario/destinatario. Retirado repositorio de invitaciones sin consumidores que todavía tenía un escritor alternativo.
- Contraseña solo generada por servidor, reserva global de activas liberada en renovación/baja, consulta/renovación solo Doctor. Asistente nunca recibe contraseña; correo del alta a ambos contactos deduplicados, fallo parcial/reintento original sin duplicar paciente. Renovación confirmada no se repite por fallo posterior de correo.
- Citas canceladas liberan ocupación; edición excluye propia cita y conserva horario original, pero otra vigente bloquea. No se añadió bloqueo atómico de citas (P22). Semana cerrada admitida; permiso de reservas exclusivo del Doctor en servidor/UI; deshabilitarlo impide también cancelación del Paciente.
- Publicaciones devuelven todos los documentos vigentes con fuente/pertenencia/fecha/HTML comprobados, sin expediente clínico privado. Bitácora/avisos se escriben desde servidor en la operación; cliente solo puede marcar leído su aviso.
- P04/P09/P13/P45 comprueban sesión dentro de las transacciones, incluyendo bajas concurrentes de Admin y excepción de Asistente de pruebas asociado a Admin sin agenda.
- Reglas raíz actuales niegan SDK de negocio; Storage deja logos públicos por enlace y restringe mutaciones al Doctor propietario con arrendamiento vigente. Directorios/horarios/publicaciones/ocupación separan información mínima de privada.
- Herramientas privadas ADC D04/D07/D08: revisión y huellas antes de aplicar, cuentas de personal conservadas, Admin operacional requerido, logos revisados con escritores detenidos y generación, retención selectiva 30 días. Barreras de baja/repetición/envío conservadas; solicitudes de invitación retiradas no recrean usuarios. No cron ni TTL indiscriminado.
- Herramienta de rotación fuera de servicio de claves AES/HMAC: conserva contraseña/verificador/época/revisión, reescribe reserva/cifrado juntos y reanuda el mismo plan. Claves solo en memoria; no ejecutada contra Firebase ni publicada en Secret Manager.
- Ventana coordinada revisable preparada con configuración separada, reglas cerradas y página temporal; dos pruebas comprueban que detiene SDK de cuatro roles/anonimato y mantiene enlaces públicos de logos.

**Evidencia:** Angular completo **862/862 en 72 archivos**, más regresión posterior de Pacientes **24/24**; Node **264/264**, con repetición posterior de mantenimiento/claves **11/11**. Emulador: reglas actuales/credenciales/Storage **44/44**; operaciones/bajas Admin **24/24**; login/rotación **14/14**; ventana de mantenimiento **2/2**. Grupos separados, no porcentaje de coverage ni suma que implique un ensayo integral desplegado. Functions build/lint aprobados sin advertencias de lint; build Angular producción aprobado. Revisión de espacios del código/documentación aprobada excluyendo el log generado `firestore-debug.log`. Auth/firma y correo simulados; solo `demo-lilcare-p01`, hosts locales, datos ficticios.

**Restante autorizado sin nuevas decisiones:** P47 global y P46; luego preparar/revisar autoridad del entorno, secretos/parámetros/IAM/índices y publicación coordinada D10. Ensayo externo omitido por D09, no aprobado ficticiamente. D11 conserva pendiente la evidencia/referencia del Doctor, no una decisión sobre responsable. Procedimiento concreto: [ACTIVACION_COORDINADA.md](security/p01/ACTIVACION_COORDINADA.md). Estado/contratos actualizados: [avance](security/p01/AVANCE_INTEGRACION.md), [credenciales](security/p01/INTEGRACION_CREDENCIALES.md). Auditorías históricas de producción/prototipo no sobrescritas; auditoría candidata actual separada.

**Observaciones de seguimiento, exclusivamente en este registro:**

| Clasificación | Observación | Criterio de verificación |
| --- | --- | --- |
| CONFIRMADO | Angular producción mantiene aviso SCSS del calendario (6,47 kB frente a 5 kB) y optimización CommonJS de Quill. Build aprobado; no se cambió presupuesto ni biblioteca para ocultar avisos. | Revisar optimización/estilos cuando se aborde esa deuda; no constituye por sí solo fallo funcional. |
| CONFIRMADO / alcance local | No se probó proveedor Auth real, Secret Manager, permisos cross-service de Storage ni SMTP desplegado en el nuevo conjunto. D09 omite el ensayo externo. | D10 debe registrar activación/metadatos; no confundir emulador con entorno ni dar por realizado ensayo omitido. |
| POSIBLE / REQUIERE INVESTIGACIÓN | Fanout de avisos recorre asistentes/expedientes familiares del Doctor sin techo explícito de destinatarios; el volumen grande no se ensayó. No se reprodujo fallo con volumen actual. | Antes de ampliar escala, medir escrituras/tamaño y límites reales; eventual entrega acotada no debe omitir destinatarios. Auditoría candidata puntúa 4 por este seguimiento, no por acceso cruzado confirmado. |
| POSIBLE / REQUIERE INVESTIGACIÓN | La instalación de dependencias Functions reportó 33 avisos de auditoría npm (17 moderados, 15 altos, uno crítico). No se estableció cuáles corresponden a runtime, transitivas/dev o explotación en esta app. | Inspeccionar árbol/advisories en una tarea de dependencias; no aplicar actualizaciones mayores ni afirmar que se introdujeron aquí sin análisis. |
| CONFIRMADO / operación | Autoridad/retención/limpieza requieren reporte nuevo si las huellas cambiaron tras una aplicación parcial. Rotación de claves, en cambio, requiere reanudar el mismo plan fuera de servicio antes de publicar nuevas versiones. | Seguir el procedimiento revisable; no sustituir secretos a ciegas, no reactivar escritores en una rotación parcial. |

### P47 — RESUELTO Y COMPROBADO LOCALMENTE (10 de octubre de 2026)

Recorrido global completado: **46 HTML externos, cinco templates inline, dos bindings de host**. Auditoría reproducible `node security/p47/template-audit.mjs` sin infracciones: presentación con signals/computed/input/contentChild/toSignal; eventos, variables locales de template y referencias de ReactiveForms conservados. No se añadió una política de negocio.

Estado de edición/carga, datos inyectados de diálogos, etiquetas, edad, opciones de gráficas, referencias de plantillas y arrays auxiliares son reactivos. El HTML ya no calcula edad/fechas/HTML/gráficas ni invoca getters/métodos ordinarios para mostrar datos. Lecturas de controles usan referencias directas, sin get/hasError en presentación. Datos derivados para mostrar no se envían como campos nuevos del registro clínico. Edades recién convertidas se invalidan con el reloj sin recargar el padrón.

**Evidencia:** Angular completo **866/866 en 73 archivos**, incluidas tres regresiones de interacción/actualización de gráficas y una de edad al cambiar fecha sin refetch. Build producción aprobado. Una ejecución previa concurrente con la auditoría TypeScript tuvo seis timeouts; la repetición completa sin esa tarea concurrente pasó, sin ampliar timeouts ni eliminar pruebas. JSDOM imprime avisos de parseo CSS; los resultados aprobados no sustituyen validación visual. Avisos SCSS/Quill del build conservados en el seguimiento P01 anterior.

Fuentes: `security/p47/template-audit.mjs`; componentes de Calendario, AppointmentDialog, Impresión, GrowthCharts, completar/editar paciente, perfiles/tarjetas, diálogos comunes, Carousel y AlertOverlay; specs afectados. El registro de avance parcial anterior es histórico. Continúa P46 y revisión/activación D10, sin declarar P01 publicado.

### P46 — RESUELTO LOCALMENTE; contextos sincronizados

Actualizados los cinco contextos funcionales y PROJECT contra el código local vigente: roles, campos/validaciones, credenciales/correo, logo/impresión, notificaciones, disponibilidad y variantes responsive. Se conservan estructura por operación, certeza, fuentes y checklist de screenshots. PROJECT conserva las 31 áreas de contexto técnico originales; los cuatro documentos por rol y shared continúan funcionales. No se capturaron pantallas ni escribieron manuales finales. Referencias locales y headings comprobados; irregularidades permanecen únicamente aquí. Evidencia externa de negocio/diseño/Doctor y activación de producción no se inventan.

### P20 — seguimiento de conservación de fecha/hora original

Verificada la decisión ya aprobada: editar motivo conservando fecha/hora original permite la propia cita vigente aunque cambie disponibilidad, cierre el día o pase su fecha; no permite otra hora inválida. El datepicker y la lista de horas ahora conservan explícitamente esa opción; el servidor ya aplicaba dicha política. Otra cita vigente cuenta como ocupación en el portal, la propia no. Quince regresiones por Doctor/Asistente/Paciente incluyen día abierto/cerrado/pasado, cambiar hora y cita ajena vigente. Contextos sincronizados. No se introducen locks de P22.

### P01/P17 — decisión posterior: Paciente sin Firebase Authentication; RESUELTO LOCALMENTE

**Decisión explícita:** acceso del Paciente solo por servidor con correo/código reutilizable; sin identidad Firebase Auth, ni cookies/localStorage. Se eligió sesión únicamente en memoria del servicio; sessionStorage también se omite, aunque el usuario lo admitió como alternativa solo cifrada. No se guarda código, bearer, perfil ni plazo de actividad del Paciente en almacenamiento del navegador. Recargar/cerrar pestaña exige ingresar nuevamente. Mantiene máximo una hora inactiva, salida a Acceso paciente y reutilización del código hasta renovación por Doctor. La política anterior de restauración del Paciente al recargar queda sustituida; los registros históricos no describen el estado vigente.

**Implementación:** login ya no firma tokens ni llama Firebase Auth. Sesión aleatoria privada de servidor con hash SHA-256 del bearer; ID interno serverOnly no representa una cuenta Firebase. Cada lectura/escritura contrasta arrendamiento, autoridad del Doctor, credencial/revisión/contactos/pertenencia actuales. Portal: familia mínima, Doctor autorizado, citas familiares, ocupación anónima, publicaciones vigentes y bandeja propia. Solo operaciones permitidas de cita y lectura de avisos; ningún bearer autoriza operaciones del personal. Rules niegan SDK al Paciente, también a identidades Firebase históricas/fabricadas. El personal conserva UID/contraseña/autenticación.

Streaming usa onSnapshot **en servidor**, valida antes de transmitir y periódicamente, sin renovar actividad al recibir datos. Retira listeners al desconectar/revocar y renueva conexión cada dos minutos. Cliente aborta al salir y descarta respuestas de otra sesión. Cierre conserva el bearer solo el tiempo necesario para revocarlo y borra estado local inmediatamente. Mantenimiento de sesiones serverOnly no elimina ni consulta cuentas Auth; compatibilidad histórica separada conservada.

**Verificación vigente:** Angular **884/884, 73 archivos**; Node **264/264**; emulador sintético **81/81** (11 autoridad/login, 21 operaciones, 18 Rules, 22 credenciales, 9 portal). Pruebas de bearer alterado, rechazo a identidad Firebase, datos familiares mínimos, citas ajenas, ocupación anónima, notificaciones/paginación propia, hora exacta, renovación/cierre, streaming/revocación, ausencia de persistencia y respuestas tardías. Functions build/lint aprobados, Angular producción aprobado, auditoría P47 51 templates + 2 bindings sin infracciones. Se actualizaron contexto Paciente/shared/PROJECT, contratos, avance, auditoría y runbook.

**Incidencias de verificación resueltas:** primer ensayo detectó ID sintético de operación con punto (no válido), corregido en fixture; contención de presupuestos podía devolver error técnico en vez de respuesta genérica, normalizado en servidor sin cambiar límites. Repetición completa del emulador aprobada. Build inicial sin red no descargaba Google Fonts; repetido con red autorizada y aprobado. Se conservan avisos previos CSS de JSDOM/SCSS/Quill. No demuestra producción ni SMTP/Auth real; D09 sigue omitiendo ensayo externo.

Fuentes: `functions/src/clinic-auth.ts`, `clinic-patient-token.ts`, `clinic-patient-portal.ts`, `clinic-operations.ts`; `src/app/core/services/auth.service.ts`, `clinic-gateway.service.ts`, repositorios de paciente/Doctor/citas/avisos; `firestore.rules`; `security/p01/patient-portal.emulator.spec.mjs`, pruebas afectadas y `prepare-maintenance.mjs`.

**Sigue D10:** preparación de ADC/autoridad del personal e inspección/revisión final del conjunto antes de publicación coordinada. Google Cloud CLI se prepara para la cuenta **del operador**, no para pacientes. No se desplegó ni creó ninguna cuenta remota en este cierre; parámetros conservan false por defecto. D11 conserva evidencia clínica externa pendiente.

### D10 — ADC autorizado; revisión del entorno y autoridad preparada

**Confirmado por el operador:** autorización de navegador completada. Google Cloud CLI portable 588.0.0; ADC disponible y proyecto de cuota configurado para el proyecto existente. Lecturas Firestore/Auth y Firebase CLI comprobadas; no se creó otra cuenta ni proyecto. No se leyeron valores de secretos ni se aplicó el reporte.

Reporte privado actualizado: **cuatro perfiles listos para revisión** (dos Admin, un Doctor, un Asistente), **una invitación pendiente excluida** y **un Doctor bloqueado por discrepancia entre `users/{documentId}` y su campo `uid`**. Todos conservan `approved:false`. El diagnóstico de autoridad conserva únicamente códigos conocidos; nunca el mensaje arbitrario de transporte. Ocho pruebas de política de operador aprobadas, incluida regresión de sanitización.

| Clasificación | Observación | Acción / decisión concreta |
| --- | --- | --- |
| CONFIRMADO | El Doctor bloqueado tiene cuenta Auth existente habilitada y binding; su `uid` almacenado difiere del ID del documento y no tiene otro perfil bajo ese valor. Tres usuarios asociados y cuatro pacientes usan el ID del documento; las citas contienen referencias a ambos IDs (27/7). No se abrieron expedientes ni copiaron datos personales. | Propuesta: normalizar **solo `uid` del perfil al ID del documento**, conservar documento, cuenta Auth/contraseña y relaciones; preparar/aplicar con revisión explícita y huellas. No mover ni borrar pacientes/citas antiguos. Solicitar decisión antes de escribir. |
| CONFIRMADO / entorno | Las cuatro Functions publicadas siguen siendo endpoints anteriores de correo. No están publicados el portal/sesiones/operaciones nuevos ni sus parámetros. | Publicar conjunto coordinado D10; no describir implementación local como activa. |
| CONFIRMADO / entorno | Cuatro índices existentes están READY. No se comprobó todavía si satisfacen todas las definiciones candidatas. | Comparar campos/alcance exactos y publicar los faltantes antes de abrir cliente. |
| CONFIRMADO / entorno | API Secret Manager figura deshabilitada; consulta de metadatos devuelve 403. Auth, Firestore, Functions, Cloud Run e IAM Credentials figuran habilitadas. | Incluir habilitación de Secret Manager y provisión privada de las tres claves en la revisión final de activación; no se habilitó ni generó/publicó secreto todavía. |

Fuentes/evidencia: `security/p01/prepare-staff-authority.mjs`, `operator-policy.mjs`, `operator-policy.spec.mjs`; reportes privados ignorados en `security/p01/review-plans/`; logs privados CLI. Reporte anterior con errores de cuota es histórico, reemplazado para diagnóstico por el nuevo. No existe aplicación parcial de autoridad.

**Revisión posterior del mismo caso:** el usuario autorizó corregir solo `uid` durante la activación. Al preparar esa corrección se comprobó que **el propio ID del documento no cumple el formato admitido por el servidor**. Cambiar únicamente `uid` no produce un acceso válido; no se aplicó. La herramienta ahora comprueba también formato de origen/propietario/Auth y mantiene códigos explicativos sanitizados. Nueve pruebas aprobadas. El reporte vigente del contrato sustituye al anterior: **tres perfiles listos** (dos Admin y un Doctor), **dos bloqueados** (Doctor con ID no admitido y Asistente cuyo propietario usa ese ID), **una invitación pendiente excluida**. Ninguna fila aprobada/aplicada. Es necesaria una decisión adicional sobre conservar IDs con validación compatible o reorganizar las asociaciones; no se autoriza implícitamente una migración por la decisión anterior.

**Revisión final del entorno, todavía solo lectura:**

- De **16 índices candidatos**, cuatro ya están READY y **12 no están presentes**. Reporte privado conserva campos/alcance para crear solo los faltantes; no se borran los cuatro existentes.
- Secret Manager sigue deshabilitado y hay **cero documentos de credenciales del nuevo esquema**. No se accedió a ningún valor de contraseña/clave. La ausencia del API no se presenta como fallo IAM de la cuenta operadora.
- Cuenta operadora tiene permisos consultados para habilitar API, crear secretos/versiones, publicar Functions, cambiar IAM y crear índices/reglas. Es una consulta de permisos, no un cambio. Hosting CLI autenticado; permisos por recurso se verificarán en la fase correspondiente.
- Políticas IAM de ejecución/proyecto legibles: no se encontró concesión explícita no condicionada de `roles/iam.serviceAccountTokenCreator` a la cuenta runtime para firmar sus tokens. **POSIBLE / REQUIERE INVESTIGACIÓN:** otras concesiones heredadas/custom no se probaron; incluir comprobación y permiso mínimo sobre la propia cuenta en activación. El Paciente no requiere firma Firebase; el personal sí. Fuente oficial: [firma de tokens personalizados](https://firebase.google.com/docs/auth/admin/create-custom-tokens).
- Manifiesto privado revisable preparado: **91 archivos de cliente**, **36 archivos compilados de servidor**, huellas de **siete configuraciones/reglas**. Sin exportar contenido de archivos privados ni datos clínicos. El manifiesto debe regenerarse si cambia un artefacto.

No se publicó Hosting/Functions/reglas/índices, habilitó Secret Manager, generó secreto ni cambió IAM. La única configuración operativa realizada fue el proyecto de cuota de ADC aprobado para el operador.

**Decisión adicional confirmada:** conservar IDs/documentos y adaptar validación del personal. Implementado validador específico de segmento acotado (ASCII, hasta 128 caracteres; incluye punto/@/+; excluye separadores, espacios, escapes de URL, segmentos reservados y `..`). Se aplica exclusivamente a perfil/propietario de Doctor/Asistente/Admin; identidad Auth y pertenencia siguen contrastadas con autoridad protegida y arrendamiento. Operaciones, pacientes, citas, sesiones y capacidades conservan su validación previa estricta. Credenciales mantienen AAD del Doctor; no se recifra ni traslada dato remoto.

Reporte nuevo preparado solo por lectura: **cinco perfiles listos, cero bloqueados y una invitación pendiente excluida**. Una fila propone `normalizeSourceUid:true`; las cinco siguen `approved:false`, ninguna aplicada. Los reportes de tres/cuatro perfiles listos son históricos y no se usarán para aplicar. Node completo **269/269**, Functions build/lint aprobados; regresiones de servidor/emulador/cliente en curso. Se mantiene la corrección remota para la ventana D10 y preservación de cuentas/contraseñas/relaciones.

**Cierre de verificación local de IDs:** Angular completo **886/886 en 73 archivos** y build producción aprobados; Node **269/269**; Functions build/lint aprobados. Emulador: autoridad/login **11/11**, Rules **19/19**, credenciales **22/22**, portal **9/9**, Storage **5/5**, bajas Admin **3/3**, rotación **3/3**, mantenimiento **2/2**; operaciones **23/23** en repetición final. La primera ejecución conjunta tuvo 96/97: el nuevo fixture llamaba al portal con firma incorrecta; corregido el fixture y repetido **todo el grupo de operaciones**, sin cambiar producción para acomodar la prueba, reducir permisos ni eliminar casos. Los otros ocho grupos aprobaron en la ejecución conjunta. No se presenta como una única ejecución integral 97/97 ni ensayo desplegado. Primer intento de CLI sin acceso a caché npm dio EACCES; repetido con permisos de caché autorizados, solo demo local. P47 mantiene 51 templates + dos host bindings sin infracciones. Logs generados `firebase-debug.log` y `firestore-debug.log` se conservan y se excluyen de la revisión de espacios de código/documentación.

**D10 listo para revisión concreta de ventana:** artefacto final con 91 archivos de cliente, 38 compilados de servidor y siete configuraciones/reglas; reporte privado de cinco correspondencias (dos Admin, dos Doctor, un Asistente), una invitación excluida y solo una normalización de `uid` propuesta. Entrega incluye crear los 12 índices faltantes conservando los existentes, provisionar tres secretos mediante entrada privada/habilitar Secret Manager, permisos mínimos de firma/acceso de servidor y conexión Storage→Firestore, mantenimiento temporal, servicios con flags cerradas, autoridad revisada, reglas finales, activación conjunta y Hosting compatible. Procedimiento y recuperación en `security/p01/ACTIVACION_COORDINADA.md`. El alcance de publicación ya está aprobado por D10 B; resta revisar/iniciar la ventana concreta. No se publicó ni aplicó el reporte durante esta preparación. D09 sigue omitiendo ensayo externo; D11/P37 sigue requiriendo referencia clínica del Doctor, no se inventa una validación.
## D10 — Registro de la ventana autorizada (2026-10-10)

- El usuario autorizó iniciar ahora la ventana coordinada tras revisar la entrega concreta.
- Fase A completada: publicación de índices con salida 0; verificación por API de los 16 índices requeridos en estado `READY`.
- Secret Manager habilitado mediante ADC; las tres claves nuevas se provisionaron directamente en el servicio, sin valores en archivos ni salida. No existían credenciales de pacientes en el almacenamiento privado que requirieran conservar otra clave.
- Firma del personal: permiso verificado sobre la propia cuenta runtime, conservando la política existente. No se usa para crear cuentas o sesiones Firebase Auth de Paciente.
- Fase B completada: reglas de mantenimiento y Hosting temporal publicados con salida 0. Fase C en ejecución con los cuatro parámetros deshabilitados. Todavía no se declara reabierto el sistema.
- Fases C/D/E completadas: 22 Functions ACTIVE con los cuatro par?metros false y secretos vinculados; cinco correspondencias aprobadas/aplicadas, conservando 2 Admins, 2 Doctores y 1 Asistente; cuenta existente habilitada y UID/doc/autoridad verificados. Reglas finales publicadas con salida 0. Fase F en ejecuci?n, Hosting todav?a en mantenimiento.
- Evidencia privada: `security/p01/d10-deploy-indexes-debug.log`, `d10-deploy-maintenance-debug.log` y reportes ignorados de `security/p01/review-plans/`.

### Cierre vigente P01/D10 — PUBLICADO / ACTIVADO / VERIFICADO POR COMPONENTE

- Fases A–G completadas con salida 0; se retiró la página de mantenimiento. Los mensajes transitorios de habilitación de API de la primera publicación quedaron resueltos antes de reabrir.
- Veintidós Functions `ACTIVE`, cuatro parámetros `true`, claves declaradas vinculadas; firma del personal limitada a su propia cuenta runtime. El Paciente no utiliza cuenta ni sesión Firebase Auth.
- Reglas efectivas de Firestore y Storage comparadas por contenido con las revisadas, ambas coinciden; 16 índices `READY` confirmados nuevamente al cierre.
- Cinco cuentas existentes conservadas: 2 Admins, 2 Doctores y 1 Asistente. Correspondencias aplicadas desde el reporte regenerado durante mantenimiento, idéntico al previo. Se comprobó cuenta habilitada, UID existente, documento conservado y autoridad. Una invitación pendiente quedó excluida. Se corrigió únicamente el `uid` de origen autorizado; ningún cambio de contraseña, traslado de documentos o migración clínica.
- Hosting: raíz, `/patient-login` y `/app/doctors` en dominio del consultorio y dominio Firebase respondieron HTTP 200 con el mismo `index.html` del artefacto revisado. Noventa y un archivos del cliente; las siete configuraciones/reglas conservan sus huellas revisadas.
- Evidencia nueva privada: `functions-deployed-enabled.json`, `authority-applied-verification.json`, `rules-effective-verification.json`, `index-state-deployed.json`, `hosting-effective-verification.json`, `hosting-published-artifact-files.json`; logs de las fases cerrada/habilitada, reglas y Hosting. No publicar sus contenidos privados.
- **Límite de la evidencia:** D09 sigue omitiendo pruebas funcionales desplegadas con cuentas/SMTP; la comprobación de publicación no acredita esos casos. Las pruebas locales previas permanecen: Angular 886/886, Node 269/269 y grupos separados de emulador documentados en el avance. No se ejecutaron correos ni acceso de pacientes reales durante la activación.
- **Estado al terminar D10, sustituido por el cierre posterior:** en esa etapa todavía faltaba la confirmación clínica de D11/P37. Herramientas de retención/limpieza quedan disponibles para ejecuciones periódicas revisadas, sin cron ni borrado indiscriminado añadido.

## Cierre posterior de los últimos seguimientos — 10 de octubre de 2026

| Punto | Estado vigente | Evidencia / alcance |
| --- | --- | --- |
| D09 — correos / ensayo externo | CERRADO POR CONFIRMACIÓN DEL USUARIO | El usuario indica «correos está perfecto» y pide no continuar ese seguimiento. El agente no ejecutó el ensayo externo; se conserva ese dato sin convertirlo en prueba aprobada. |
| Notificaciones — volumen de destinatarios | CERRADO POR ACEPTACIÓN DEL USUARIO | El usuario informa que estaban funcionando bien y acepta conservarlas. No se cambia la lógica, no se introduce techo de destinatarios y no se afirma haber probado gran volumen. La observación técnica previa permanece como historia aceptada, no como pendiente activo. |
| P37 / D11 — curvas y vacunación | CERRADO POR CONFIRMACIÓN DEL DOCTOR COMUNICADA POR EL USUARIO | El usuario comunica «el doctor confirma la curva de crecimiento y esquema de vacunación». Se conserva la implementación; no se inventa referencia bibliográfica ni certificación independiente del agente. |

**No quedan pendientes abiertos de la lista actual.** Este cierre no afirma que nunca puedan aparecer incidencias nuevas. No se modificaron código de producción, reglas, configuración ni despliegues para registrar estas confirmaciones.
