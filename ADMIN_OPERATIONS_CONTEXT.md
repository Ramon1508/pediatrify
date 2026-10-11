# ADMINISTRADOR

**Revisión vigente: 10 de octubre de 2026 (P46/D10).** Describe el comportamiento confirmado en código y pruebas locales. El conjunto de servicios ya fue publicado y habilitado en la ventana D10 autorizada; se verificaron configuración y rutas públicas. No se ejecutaron pruebas funcionales con cuentas reales ni SMTP por decisión D09. Consultar [condiciones compartidas](SHARED_OPERATIONS_CONTEXT.md#condiciones-de-disponibilidad-para-los-futuros-manuales). No es un manual final ni contiene capturas; la auditoría inicial es histórica.

Contexto funcional para redactar el futuro manual del Administrador de Lilcare. Auditoría estática del repositorio local al 4 de octubre de 2026, referencia 76791ac. No es el manual final ni una validación en producción; no se capturaron pantallas ni datos reales. Complemento: [contexto compartido](SHARED_OPERATIONS_CONTEXT.md). CONFIRMADO significa verificable en código; APARENTE / REQUIERE VALIDACIÓN indica información funcional inferida; NO DETERMINABLE DESDE EL CÓDIGO requiere información externa.

Actualización funcional local del 9 de octubre de 2026 (P44/P45): el Administrador dispone de Doctores, Administradores y Bitácora, en ese orden; su entrada sigue siendo Doctores. Puede editar únicamente su correo desde Perfil; nombre propio de lectura. Invitaciones, cambio de datos de otro Administrador y bajas están implementados localmente, publicados y habilitados mediante D10; el ensayo funcional externo con cuentas/SMTP fue omitido por D09.

## 1. Propósito del rol

**CONFIRMADO en código local:** el Administrador gestiona dos directorios independientes, Doctores y Administradores: invita, reenvía invitaciones pendientes, modifica nombre/correo y elimina otras cuentas según las restricciones descritas. Consulta la Bitácora. Identificador interno admin.

No es un superusuario clínico en la experiencia actual: no tiene Calendario, Pacientes, historiales, vacunas, gráficas, Asistentes o Impresión disponibles desde su navegación normal. No existe un botón para actuar como Doctor ni cambiar a su sesión. No recibe notificaciones de citas.

La primera cuenta administrativa necesita preparación autorizada externa; las siguientes pueden ser invitadas por un Administrador existente desde Administradores. No hay autorregistro público de este rol. El código de inicialización/mantenimiento no es una función normal del usuario.

Fuentes revisadas: [rutas](src/app/app.routes.ts), [directorio por rol](src/app/pages/doctors/doctors.ts), [layout](src/app/pages/doctor-layout/doctor-layout.ts).

**Invitaciones:** integradas con protección de acceso y comprobadas localmente; permanecen deshabilitadas por defecto hasta activación del entorno. No se enviaron invitaciones reales durante esta revisión.

## 2. Inicio de sesión / acceso

- Login de personal: Correo electrónico y Contraseña → Iniciar sesión. Correo requerido y válido; contraseña requerida; ojo para mostrar/ocultar.
- Registro completo: entra a Doctores. Perfil incompleto: Registro inicial; Administrador ve «Bienvenido», contraseña/confirmación y Finalizar, sin datos profesionales del Doctor.
- Contraseña nueva del registro: mínimo ocho caracteres, mayúscula, minúscula, número y símbolo; confirmación igual. Al terminar vuelve al login con «Tu cuenta ha sido creada».
- No hay enlace de autorregistro como Administrador. Para cuentas siguientes: otro Administrador → Administradores → Agregar administrador → invitación. El invitado define únicamente contraseña y confirmación; nombre/correo proceden de la invitación.
- Olvidé mi contraseña abre recuperación por correo. Introducir correo → Recuperar contraseña → enlace → Nueva contraseña/Confirmar → Restablecer contraseña → login. Mensajes de enlace expirado/no válido solicitan uno nuevo.
- Credenciales incorrectas: «Correo o contraseña incorrectos». Recuperación enviada: «Correo de recuperación enviado. Revisa tu bandeja de entrada.».
- La lógica del personal cierra sesión tras una hora de inactividad; no se verificó un aviso previo dedicado.
- El acceso habitual se realiza desde login y conduce a Doctores. Con sesión autorizada, abrir la entrada general `/app` también muestra Doctores (actualización local P14, igual en desktop/mobile).

**Mobile:** botones de acceso en columna; registro breve adaptable. **Estado de certeza:** CONFIRMADO en UI; aprovisionamiento inicial y entrega efectiva de correos NO DETERMINABLE DESDE EL CÓDIGO.

Fuentes revisadas: [login](src/app/pages/login/login.ts), [registro](src/app/pages/setup-profile/setup-profile.html), [recuperación](src/app/pages/reset-password/reset-password.ts), [sesión](src/app/core/services/auth.service.ts).

## 3. Pantalla inicial

Doctores presenta título, Agregar doctor, búsqueda «Buscar por nombre» y tarjetas con nombre/correo. Menú de tres puntos por tarjeta: Editar doctor, Reenviar invitación cuando no completó registro y Eliminar doctor.

Encabezado con marca y botón de perfil, sin campana de notificaciones. Hay navegación lateral en desktop y barra inferior hasta 768 px: Doctores, Administradores, Bitácora. No existe panel de consultas del día o indicadores clínicos.

Sin doctores: «No has agregado ningún doctor», con Agregar doctor. Búsqueda sin coincidencias no tiene otro mensaje específico identificado. La lista excluye asistentes y administradores; no es un directorio de todas las cuentas.

Fuentes revisadas: [pantalla](src/app/pages/doctors/doctors.html), [filtrado](src/app/pages/doctors/doctors.ts), [encabezado](src/app/shared/components/header/header.html).

## 4. Navegación principal

| Opción visible | Qué abre / propósito | Mobile |
|---|---|---|
| Doctores | Página inicial; listado y gestión de profesionales | Entrada en barra inferior |
| Administradores | Listado y gestión de otras cuentas administrativas | Entrada en barra inferior |
| Bitácora | Registro de cambios, solo lectura; última opción | Entrada en barra inferior; tabla con scroll horizontal |
| Agregar doctor | Invitar doctor | Panel inferior en vez de derecho |
| Buscar por nombre | Filtra tarjetas | Mismo criterio |
| Menú de tres puntos | Edición, reenvío pendiente, eliminación | Mismas opciones |
| Icono de cuenta | Perfil, Editar perfil para cambiar su correo y Cerrar sesión | Página de lectura; edición en panel inferior |
| Marca del encabezado | Regresa a la entrada correspondiente al Administrador | Misma finalidad |

No hay navegación para Asistentes, pacientes, agenda o impresión. No hay Dashboard ni editor de roles/permisos.

Fuentes revisadas: [directorios](src/app/pages/doctors/doctors.html), [header](src/app/shared/components/header/header.ts), [rutas](src/app/app.routes.ts).

## 5. Funciones disponibles

### 5.1 Consultar y buscar doctores

**Objetivo:** localizar un profesional para gestionar su alta o datos.

**Cómo llegar:** iniciar sesión → Doctores.

**Pasos:**

1. Revisa tarjetas.
2. Escribe parte del nombre.
3. Localiza el doctor.
4. Abre sus tres puntos para elegir operación.

**Campos:** Buscar por nombre, texto opcional; nombre/correo en tarjetas son lectura.

**Acciones:** búsqueda filtra por nombre sin distinguir mayúsculas; limpiar restaura lista; tres puntos abre menú. No hay buscador por cédula/especialidad ni filtro de estado visible.

**Resultado esperado:** se muestran las tarjetas coincidentes. Solo doctores, no otros administradores/asistentes.

**Validaciones:** sin filtros adicionales; no es necesario seleccionar un resultado para que la búsqueda funcione.

**Mensajes / estados especiales:** sin datos «No has agregado ningún doctor»; búsqueda vacía puede mostrar ausencia de tarjetas sin explicación dedicada. Reenviar aparece solo para pendientes.

**Mobile:** tarjetas se ajustan al ancho; no aparece una tabla alternativa. La barra inferior permite cambiar entre las tres áreas administrativas.

**Dependencias con otros roles:** datos de profesionales que han sido invitados o registrados; el Doctor finaliza su perfil por sí mismo.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [directorio](src/app/pages/doctors/doctors.ts), [vista](src/app/pages/doctors/doctors.html).

### 5.2 Invitar / agregar un Doctor

**Objetivo:** preparar el acceso de un profesional y entregarle el enlace para completar su registro.

**Cómo llegar:** Doctores → Agregar doctor → Invitar doctor.

**Pasos:**

1. Captura Nombre completo y Correo electrónico.
2. Pulsa Crear invitación.
3. Revisa si se envió el correo.
4. Si el correo no se confirma, pulsa Reintentar envío o copia el enlace y entrégalo por el canal autorizado. No vuelvas a crear el Doctor por un fallo de correo.
5. Pulsa Cerrar; el Doctor termina posteriormente su registro profesional y contraseña.

**Campos:** nombre obligatorio, no solo espacios, hasta 200 caracteres; correo obligatorio, válido, hasta 254 caracteres. Quedan de lectura tras crear la invitación. No hay selector de rol, contraseña, cédula, horario ni logo: desde Doctores se invita a un Doctor; desde Administradores se invita a un Administrador.

**Acciones:** Crear invitación registra y trata de enviar; Reintentar envío aparece ante fallo y envía nuevamente el mismo enlace al mismo destinatario, sin crear otro Doctor. Copiar confirma la copia o avisa si falla. Cerrar/X termina la ventana, bloqueados mientras se crea/envía. Administradores tiene su operación independiente; no se ofrece crear un Asistente en la UI del Admin.

**Resultado esperado:** doctor pendiente en directorio; enlace disponible; mensaje de invitación enviada cuando el envío termina bien. El registro inicial del Doctor completa sus datos profesionales.

**Validaciones:** un correo ya registrado o reservado se rechaza y pide revisar/reenvíar el pendiente del directorio. El enlace dura siete días y solo completa una cuenta. Reenviar invalida el anterior; Reintentar envío no renueva su plazo. Nombre/correo; Crear deshabilitado con formulario intacto/erróneo o petición activa. Mensajes instructivos para nombre hasta 200 caracteres y correo válido hasta 254. Spinner y cierre bloqueado mientras crea/envía; no reintentos simultáneos.

**Mensajes / estados especiales:** «Invitación creada. Enviando el correo…» durante envío; después, confirmación al correo mostrado o «La invitación está creada, pero no se pudo confirmar el envío del correo. Reintenta el envío o copia el enlace manualmente.». Fallo de creación: «No fue posible crear la invitación. Intenta nuevamente.», sin enlace. Confirmación de envío no acredita recepción/lectura. «Enlace copiado al portapapeles» o aviso de copia fallida.

**Mobile:** formulario en panel inferior, enlace puede envolver y acciones Reintentar envío/Cerrar apiladas de ancho completo hasta 768 px; desktop panel derecho. Mismos estados en ambos.

**Dependencias con otros roles:** el Doctor debe abrir el enlace, definir contraseña y completar registro; Administrador no elige su contraseña inicial ni rellena su información profesional.

**Estado de certeza:** CONFIRMADO en código local: duplicados rechazados, enlace de un uso y siete días de vigencia. Servicio preparado deshabilitado por defecto hasta activación coordinada; recepción de correo real REQUIERE VALIDACIÓN.

Fuentes revisadas: [invitar](src/app/pages/doctors/dialogs/invite-doctor-dialog/invite-doctor-dialog.ts), [texto/campos](src/app/pages/doctors/dialogs/invite-doctor-dialog/invite-doctor-dialog.html), [registro Doctor](src/app/pages/setup-profile/setup-profile.html).

### 5.3 Reenviar invitación pendiente

**Objetivo:** volver a enviar el acceso a un Doctor que todavía no completó registro.

**Cómo llegar:** Doctores → tres puntos de un doctor pendiente → Reenviar invitación.

**Pasos:**

1. Comprueba nombre y correo de tarjeta.
2. Pulsa Reenviar invitación.
3. Revisa los datos de lectura en el panel y pulsa Reenviar invitación. Se conserva la cuenta pendiente, se invalida el enlace anterior y se emite uno nuevo por siete días.
4. Revisa el estado de envío; ante fallo reintenta dentro del panel o copia el enlace.

**Campos:** abre el panel Reenviar invitación con nombre y correo de lectura; usa los datos actuales de la cuenta pendiente.

**Acciones:** el menú abre el panel; Reenviar invitación confirma emisión y envío, Copiar permite entregar el enlace y Reintentar envío usa el mismo enlace ante fallo. Cerrar antes de confirmar no emite uno nuevo. No cambia la contraseña de una cuenta completa.

**Resultado esperado:** correo de invitación enviado; el estado pendiente no se transforma en completo hasta que el Doctor finaliza registro.

**Validaciones:** opción únicamente para cuenta marcada pendiente; un perfil incompleto sin ese estado no basta. No hay envío masivo.

**Mensajes / estados especiales:** éxito de invitación reenviada o error de envío; no prueba de lectura/entrega del destinatario en la UI.

**Mobile:** mismo menú/acción, alertas adaptadas.

**Dependencias con otros roles:** Doctor recibe y completa; cuentas completas usan Olvidé mi contraseña en login.

**Estado de certeza:** CONFIRMADO.

Fuentes revisadas: [reenvío](src/app/pages/doctors/doctors.ts), [opción condicional](src/app/pages/doctors/doctors.html).

### 5.4 Editar nombre o correo de un Doctor

**Objetivo:** corregir nombre o correo de acceso, conservando la misma cuenta.

**Cómo llegar:** Doctores → tres puntos → Editar doctor.

**Pasos:** 1. Revisa nombre y correo. 2. Cambia los datos necesarios. 3. Pulsa Guardar cambios. 4. Si era una invitación pendiente, reenvíala al nuevo correo después de guardar.

**Campos:** Nombre completo obligatorio, no solo espacios y hasta 200 caracteres; Correo electrónico obligatorio, válido y hasta 254 caracteres. No solicita nuevas contraseñas ni datos profesionales.

**Acciones:** Guardar cambios aplica; X cierra sin guardar. Cierre/entrada y guardado bloqueados durante petición.

**Resultado esperado:** nombre actualizado si solo cambia ese dato. Si cambia correo de cuenta activa, el próximo acceso utiliza el nuevo correo y contraseña actual, conservando pacientes, datos y asociación. La sesión del Administrador continúa. Invitación pendiente: se actualiza correo y se pide reenviar; no se crea acceso automáticamente.

**Validaciones:** Guardar deshabilitado si inválido/intacto/sin cambio/carga. Se rechaza correo utilizado por otra cuenta, sesión sin permiso o edición desactualizada.

**Mensajes / estados especiales:** «Doctor actualizado.»; para correo activo avisa nuevo acceso con contraseña actual; para pendiente «Reenvía la invitación al nuevo correo.». Error conserva borrador; reintentar con los mismos datos.

**Mobile:** editor en panel inferior; mismos campos y validaciones.

**Dependencias con otros roles:** Doctor debe conocer su correo actualizado; sus datos profesionales los modifica en su perfil.

**Estado de certeza:** CONFIRMADO localmente. Edición de nombre sigue disponible; cambio de correo requiere activación y prueba integrada del servicio antes de incluirlo como operación disponible en producción.

Fuentes revisadas: `src/app/pages/doctors/dialogs/edit-doctor-dialog/edit-doctor-dialog.ts`, `.html`, `src/app/core/services/staff-email-change.service.ts`, `functions/src/staff-email-change.ts`.

### 5.5 Eliminar un Doctor

**Objetivo:** retirar su registro y los expedientes/citas ligados a él.

**Cómo llegar:** Doctores → tres puntos → Eliminar doctor.

**Pasos:**

1. Selecciona el profesional correcto.
2. Lee la advertencia.
3. Pulsa Eliminar doctor para aceptar o Cancelar para conservarlo.

**Campos:** no motivo, reautenticación o texto de nombre obligatorio.

**Acciones:** confirmación con botón rojo. El diálogo advierte sobre la eliminación de registros asociados y el carácter irreversible de la acción.

**Resultado esperado:** cuando el servicio de baja está habilitado, se eliminan el acceso y perfil del Doctor y sus Asistentes asociados, sus pacientes, datos clínicos y citas vinculadas; también logos, bandejas y avisos asociados a las citas eliminadas. Los horarios/ajustes de impresión desaparecen con el perfil. El Doctor desaparece del directorio después de la confirmación completa; mensaje de éxito o error.

**Validaciones:** confirmación previa de eliminación; durante el proceso ambos botones quedan deshabilitados y el modal no se puede cerrar. El servidor comprueba que el Administrador pueda eliminar la cuenta seleccionada.

**Mensajes / estados especiales:** botón «Eliminando…» mientras se procesa. No hay deshacer, papelera o restauración desde la UI. Si no termina, el diálogo permanece abierto y permite reintentar; no muestra éxito antes de la confirmación del servidor.

**Mobile:** modal adaptable; misma advertencia y consecuencia.

**Dependencias con otros roles:** implica la baja de sus Asistentes y afecta expedientes/portal de sus pacientes; un tutor con otros expedientes puede conservar acceso por ellos. No es una operación general para eliminar Asistentes desde el directorio del Administrador.

**Estado de certeza:** CONFIRMADO en implementación local; activación y prueba del servicio integrado pendientes. No presentar todavía como operación validada en producción.

Fuentes revisadas: [confirmación](src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.html), [acción](src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.ts), [servicio de baja](src/app/core/services/staff-deletion.service.ts), [baja en servidor](functions/src/staff-deletion.ts).

### 5.6 Consultar perfil, cambiar correo propio y cerrar sesión

**Objetivo:** comprobar identidad, cambiar el correo de acceso y finalizar sesión.

**Cómo llegar:** cuenta del encabezado → Perfil → Editar perfil.

**Pasos:** 1. Revisa Administrador/nombre y correo. 2. Pulsa Editar perfil. 3. Cambia Correo electrónico. 4. Guarda o cancela. 5. Tras cambio confirmado, vuelve a iniciar sesión con nuevo correo y contraseña actual.

**Campos:** Nombre completo de lectura/deshabilitado. Correo obligatorio, válido y hasta 254 caracteres. Sin contraseña nueva, datos profesionales, logo o asociación editable.

**Acciones:** Editar abre formulario; Guardar cambios aplica exclusivamente correo; Cancelar descarta borrador; Cerrar sesión termina acceso y abre login.

**Resultado esperado:** misma cuenta, nombre y contraseña conservados; vuelve al login con «Correo actualizado. Inicia sesión con tu nuevo correo y tu contraseña actual.».

**Validaciones:** Guardar deshabilitado si inválido/intacto/sin cambio/carga; validación «Ingresa un correo electrónico válido de hasta 254 caracteres.». Correo duplicado se rechaza.

**Mensajes / estados especiales:** spinner y cierre bloqueado mientras guarda; aviso antes de guardar de que deberá iniciar sesión otra vez. Error conserva borrador para reintentar; si el correo ya cambió pero falla cierre de sesión, lo indica explícitamente. No anuncia éxito de una respuesta sin confirmación.

**Mobile:** Perfil es página de lectura; Editar abre panel inferior. Cancelar cierra sin guardar; correo confirmado cierra panel y vuelve al login.

**Dependencias con otros roles:** no necesita otro rol para esta edición propia. Otro Administrador puede modificar nombre/correo de esta cuenta desde Administradores; el propietario solo puede editar su correo desde Perfil.

**Estado de certeza:** CONFIRMADO localmente; cambio de correo conectado pero deshabilitado hasta activación del servicio, con prueba integrada pendiente.

Fuentes revisadas: `src/app/shared/components/profile-dialog/profile-dialog.ts`, `.html`, `src/app/core/services/staff-email-change.service.ts`, `functions/src/staff-email-change.ts`.

### 5.7 Consultar y buscar Administradores

**Objetivo:** localizar cuentas administrativas para gestionar su incorporación o acceso.

**Cómo llegar:** navegación → Administradores (`/app/admins`, exclusiva de Admin).

**Pasos:** 1. Revisa nombre/correo en tarjetas. 2. Escribe parte del nombre en Buscar por nombre. 3. Abre el menú de la cuenta elegida.

**Campos:** búsqueda opcional por nombre, sin distinguir mayúsculas; tarjetas de lectura. No hay filtro por correo/estado.

**Acciones:** Agregar administrador abre una invitación de rol fijo; menú ajeno ofrece Editar administrador, Reenviar invitación solo si pendiente y Eliminar administrador. En la tarjeta propia, Editar y Eliminar están deshabilitados; el correo propio se modifica desde Perfil.

**Resultado esperado:** listado únicamente de Administradores, incluida la cuenta propia si está presente en el directorio; sin Doctores ni Asistentes.

**Validaciones:** exclusiva de Admin; escribir no selecciona una cuenta. Guardar una invitación no concede acceso hasta completar su registro.

**Mensajes / estados especiales:** barra de carga; si la lista completa está vacía, «No has agregado ningún administrador» y Agregar administrador. Con un Admin activo correctamente incluido, ese vacío no es el estado normal. Búsqueda sin coincidencias deja el área de tarjetas vacía, sin mensaje específico.

**Mobile:** misma búsqueda y tarjetas, barra inferior para cambiar de área; formularios pasan de panel derecho a inferior.

**Dependencias con otros roles:** ninguna operación clínica se concede por ser Admin.

**Estado de certeza:** CONFIRMADO por código/pruebas locales; lectura con permisos del ambiente definitivo REQUIERE VALIDACIÓN.

Fuentes revisadas: `src/app/pages/doctors/doctors.ts`, `doctors.html`, `src/app/app.routes.ts`, `src/app/shared/components/sidebar/sidebar.ts`.

### 5.8 Invitar y reenviar acceso de otro Administrador

**Objetivo:** incorporar otro responsable administrativo, conservando el mismo patrón de invitación de Doctores.

**Cómo llegar:** Administradores → Agregar administrador → Invitar administrador; para un pendiente: tarjeta → Reenviar invitación.

**Pasos:** 1. Captura nombre y correo. 2. Pulsa Crear invitación. 3. Comprueba envío o copia el enlace por el canal autorizado. 4. El invitado abre el enlace y define contraseña/confirmación. 5. Finalizar vuelve al login; su acceso habitual abre Doctores con las tres áreas administrativas.

**Campos:** nombre obligatorio, hasta 200 caracteres y no solo espacios; correo obligatorio, válido y hasta 254. Contraseña del registro: al menos ocho caracteres, mayúscula, minúscula, número y símbolo; confirmación igual. No pide datos profesionales ni permite elegir otro rol.

**Acciones:** Crear invitación, Copiar, Reintentar envío y Cerrar tienen los estados de 5.2. Reenviar emite un enlace nuevo para la misma cuenta administrativa pendiente y anula el anterior; no convierte al destinatario en Doctor ni cambia su contraseña si ya completó registro.

**Resultado esperado:** cuenta administrativa pendiente y enlace de siete días; al finalizar registro, cuenta completa. Confirmación de envío no garantiza recepción.

**Validaciones:** solamente un Admin puede incorporar otro Admin o un Doctor; correo ocupado/reservado se rechaza. Nombre/correo pasan a lectura tras emitir; creación/envío simultáneo y cierre durante solicitud se bloquean. Invitación vencida, utilizada o reemplazada exige un enlace válido nuevo.

**Mensajes / estados especiales:** los mensajes de envío/fallo/copia son los compartidos en 5.2; un fallo de correo conserva la cuenta y permite reintentar sin duplicarla.

**Mobile:** panel inferior, enlace ajustable y acciones apiladas; registro breve de contraseña/confirmación.

**Dependencias con otros roles:** un Admin existente invita; el nuevo Admin completa su propio registro. La primera cuenta depende de preparación externa.

**Estado de certeza:** CONFIRMADO localmente; emisión/registro dependen de activar el servicio preparado y validar el ambiente.

Fuentes revisadas: `src/app/pages/doctors/dialogs/invite-doctor-dialog/`, `src/app/pages/setup-profile/`, `functions/src/staff-invitations.ts`.

### 5.9 Editar o eliminar otro Administrador

**Objetivo:** corregir nombre/correo o retirar el acceso administrativo de otra persona.

**Cómo llegar:** Administradores → tarjeta ajena → Editar administrador / Eliminar administrador.

**Pasos de edición:** 1. Corrige Nombre completo y/o Correo electrónico. 2. Guarda. 3. Si es una invitación pendiente, reenvíala con los datos actualizados. Cuenta completa: nuevo correo conserva la contraseña; el operador sigue en su sesión.

**Campos:** nombre obligatorio, no solo espacios, hasta 200 caracteres; correo obligatorio, válido y hasta 254. Sin contraseña ni selector de rol.

**Pasos de baja:** 1. Revisa la cuenta. 2. Lee «se eliminarán su cuenta de acceso y su perfil» y advertencia de irreversibilidad. 3. Eliminar administrador confirma; Cancelar conserva la cuenta.

**Acciones:** Guardar cambios queda bloqueado sin cambios, con errores o durante petición; X descarta. En baja, ambos botones/cierre se bloquean durante Eliminando…; error conserva el diálogo para reintentar.

**Resultado esperado:** editar conserva identidad; baja completada quita perfil y acceso del Admin. Los Doctores que este Admin incorporó, sus pacientes y las entradas existentes de Bitácora se conservan. No hay deshacer/restauración en la UI.

**Validaciones:** no permite baja propia; siempre debe quedar otro Admin activo con acceso completo, no solamente una invitación pendiente. El servidor vuelve a verificar permisos y esta condición durante la baja. La tarjeta propia tampoco permite editar desde el directorio: Perfil solo habilita correo propio.

**Mensajes / estados especiales:** «Administrador actualizado.» / aviso de reenviar al actualizar un pendiente; «Administrador eliminado» al completar baja; «Debe permanecer al menos un administrador activo con acceso al sistema.» si esa condición impide borrar. Fallos de correo duplicado o cambios simultáneos conservan el borrador. Ningún éxito se anuncia antes de confirmar la operación.

**Mobile:** edición en panel inferior; baja sigue como confirmación modal adaptable, con iguales consecuencias.

**Dependencias con otros roles:** solo otro Admin puede gestionar esta cuenta; Doctor/Asistente/Paciente no pueden hacerlo.

**Estado de certeza:** CONFIRMADO localmente y verificado con Firestore emulado para bajas simultáneas; activación/prueba integrada pendiente.

Fuentes revisadas: `src/app/pages/doctors/dialogs/edit-doctor-dialog/`, `delete-doctor-dialog/`, `functions/src/staff-email-change.ts`, `functions/src/staff-deletion.ts`, `security/p45/admin-management.emulator.spec.mjs`.

### 5.10 Consultar Bitácora

**Objetivo:** revisar cambios registrados por el sistema; no equivale a un historial completo de todas las acciones.

**Cómo llegar:** navegación → Bitácora (última opción, `/app/audit-log`).

**Pasos:** 1. Revisa Registro de cambios. 2. Lee Acción, Entidad, ID abreviado, Realizado por, Fecha y Cambios. 3. Desplaza horizontalmente la tabla cuando no cabe.

**Campos:** solo lectura; acciones pueden verse como create/update/delete; cambios muestran valores Anterior/Nuevo cuando existen. La fecha se presenta según la zona del dispositivo; no hay selector de zona.

**Acciones:** consulta de tabla; sin buscador, filtros, exportación, modificación ni eliminación de registros en esta pantalla.

**Resultado esperado:** hasta 200 filas ordenadas por fecha descendente, actualizadas mientras se recibe información. No hay paginación para consultar registros anteriores desde esta pantalla.

**Validaciones:** acceso exclusivo de Admin; una operación no registrada no aparece por el mero hecho de haber ocurrido.

**Mensajes / estados especiales:** barra de carga; «No hay cambios registrados». No hay recuperación de errores/reintento visible dedicado.

**Mobile:** misma tabla con scroll horizontal; no hay tarjetas alternativas ni columnas móviles reducidas.

**Dependencias con otros roles:** muestra únicamente acciones que esos flujos registran; cobertura exacta por operación debe validarse antes de atribuirle trazabilidad completa.

**Estado de certeza:** CONFIRMADO por código; contenido/permisos del ambiente real REQUIERE VALIDACIÓN.

Fuentes revisadas: `src/app/pages/audit-log/`, `src/app/core/repositories/audit.repository.ts`, `src/app/app.routes.ts`.

## 6. Flujos completos

| Flujo | Secuencia |
|---|---|
| Acceso habitual | Login → credenciales → Doctores → buscar profesional → acción del menú |
| Cambiar correo propio | Cuenta → Perfil → Editar perfil → Correo electrónico → Guardar cambios → login con nuevo correo/contraseña actual (tras activar servicio) |
| Incorporación de Doctor | Agregar doctor → nombre/correo → Crear invitación → correo o copia manual → Doctor completa Registro → cuenta completa |
| Invitación no recibida | Buscar doctor pendiente → Reenviar invitación → revisar resultado; no duplicar el alta si la invitación ya existe |
| Corrección de nombre | Buscar → Editar doctor → nombre → Guardar cambios → directorio |
| Baja | Buscar → Eliminar doctor → confirmación → borrado de registros asociados |
| Recuperación propia | Olvidé mi contraseña → correo → enlace → nueva contraseña/confirmación → login → Doctores |
| Incorporación de Admin | Administradores → Agregar administrador → invitación → invitado define contraseña → login → Doctores |
| Gestión de Admin ajeno | Administradores → buscar → Editar / Eliminar administrador → validaciones → listado actualizado |
| Registro de cambios | Navegación → Bitácora → leer tabla; sin modificar registros |

No incluir entrar como Doctor, atender consultas, inspeccionar historiales o gestionar Asistentes como pasos administrativos normales. La excepción de crear Asistentes por backend para pruebas no tiene entrada en la UI y no pertenece al manual de usuario.

## 7. Responsive / mobile

| Área | Desktop | Tablet | Mobile |
|---|---|---|---|
| Doctores / Administradores | Tarjetas/búsqueda con sidebar | Menos márgenes y wrapping | Tarjetas adaptables; barra inferior de áreas |
| Bitácora | Tabla de lectura | Scroll horizontal si falta espacio | Misma tabla, scroll horizontal |
| Invitación/edición | Panel derecho | Panel adaptable | Panel inferior con scroll y acciones |
| Enlace de invitación | Campo/enlace copiable | Puede envolver | Revisar ancho y accesibilidad del botón copiar |
| Confirmación de baja | Modal | Modal | Modal adaptable, texto envuelto |
| Perfil propio | Modal | Modal | Página completa de lectura |
| Login/recuperación | Botones en fila según pantalla | Formulario adaptable | Botones apilados |

Umbral móvil general hasta 768 px; tablet 769–1024 px conserva muchos patrones de desktop. No hay una experiencia específica de tablet ni una tabla alternativa confirmada. Campos no necesariamente pasan todos a una columna si aún caben.

Fuentes revisadas: [estilos compartidos](src/styles.scss), [directorio](src/app/pages/doctors/doctors.scss), [perfil](src/app/pages/profile-page/profile-page.ts), estilos de diálogos de doctores.

## 8. Empty states

| Lugar | Mensaje | Acción |
|---|---|---|
| Directorio sin doctores | «No has agregado ningún doctor» | Agregar doctor → invitación |
| Búsqueda sin coincidencias | No hay mensaje específico identificado; no aparecen tarjetas | Borrar/cambiar búsqueda |
| Perfil sin dato previsto | Campo vacío/lectura según registro; no un alta libre | Editar perfil: solo correo |
| Administradores sin datos | «No has agregado ningún administrador»; no se espera si la cuenta activa está incluida | Agregar administrador |
| Bitácora sin registros | «No hay cambios registrados» | Sin botón de alta en esta pantalla |
| Notificaciones | Campana no visible, no una lista vacía normal | No enseñar acceso de notificaciones para Admin |

No existe dashboard vacío de pacientes para este rol. Una página no accesible no es un empty state funcional.

## 9. Confirmaciones y acciones destructivas

- Eliminar doctor: confirmación explícita y advertencia de irreversible; aceptar borra registros, Cancelar conserva. No deshacer en UI.
- Eliminar administrador: confirmación explícita; acepta retirar únicamente su cuenta/perfil, conserva Doctores y sus datos. Bloquea baja propia y ausencia de otro Admin operativo; Cancelar conserva.
- Invitar/reinvitar: sin confirmación destructiva; crear permanece aunque falle el envío.
- X de invitación/edición: cierra sin una pregunta universal de abandonar cambios.
- Cerrar sesión: acción directa del perfil, sin confirmación adicional identificada.

## 10. Estados read-only y editables

- Tarjetas: lectura; menú abre operaciones.
- Invitación: nombre/correo editables hasta crear; enlace posterior sirve para copiar, no editar rol.
- Editar doctor/otro administrador: nombre y correo; datos profesionales detallados no aparecen. Cuenta administrativa propia: ambos botones de gestión están deshabilitados en su tarjeta.
- Perfil propio: lectura inicial; Editar perfil permite únicamente Correo electrónico. Nombre fijo, sin datos profesionales; Cerrar sesión en lectura.
- Registro inicial de Administrador: contraseñas; los campos profesionales se omiten.
- Reenviar solo cuando pendiente; no se ofrece para reemplazar contraseña ya registrada.
- Bitácora: totalmente de lectura.

## 11. Validaciones

| Operación | Validación / mensaje conocido |
|---|---|
| Login | Correo requerido válido y contraseña requerida; «Correo o contraseña incorrectos» |
| Registro/recuperación | Mínimo ocho, mayúscula, minúscula, número y símbolo; «Las contraseñas no coinciden» |
| Invitar | Nombre/correo requeridos y formato válido |
| Editar nombre | «Ingresa el nombre completo», «Ingresa un correo electrónico válido» |
| Correo del perfil propio | Obligatorio, válido, máximo 254; «Ingresa un correo electrónico válido de hasta 254 caracteres.»; Guardar bloqueado por errores/intacto/carga; nombre propio fijo |
| Eliminar | Confirmación; no motivo ni reingreso de contraseña |

Los botones de enviar/guardar se bloquean por carga, pero no todos por formulario inválido; puede ser necesario pulsar para que se muestren errores. No deducir comportamiento de diseño ideal.

## 12. Estados de carga y error

- Login/recuperación e invitación/edición: spinner o bloqueo de la acción durante solicitud.
- Directorio carga información y presenta tarjetas o estado vacío.
- Invitación creada con fallo de correo: alerta específica y enlace manual; la creación no se revierte.
- Reenvío: alerta de éxito/error; no seguimiento de lectura del correo.
- Edición: error dentro del formulario y mensajes de validación.
- Perfil propio: spinner al guardar correo; éxito pide iniciar sesión con nuevo correo y contraseña actual; error conserva el borrador. No permite guardar cambios al nombre propio.
- Eliminación: alerta de éxito/error, sin mecanismo de restauración o reintento masivo visible.
- Recuperación: alerta de enlace expirado/no válido, o error de envío; mensaje de límite de envío puede permanecer más tiempo.
- Hay Bitácora de cambios de lectura; no hay centro de soporte, logs de infraestructura ni gestión de bloqueos de cuenta desde UI.

## 13. Notificaciones

**CONFIRMADO:** Administrador excluido de destinatarios de avisos de citas y campana oculta. La presencia de una ruta compartida preparada de notificaciones no la convierte en función normal de este rol. No documentar alertas clínicas, unread badge o navegación a reservas para Admin.

Las alertas temporales de éxito/error de sus acciones sí aparecen y son diferentes de notificaciones persistentes de campana.

Fuentes revisadas: [campana](src/app/shared/components/notification-bell/notification-bell.ts), [destinatarios](src/app/core/services/notification.service.ts).

## 14. Perfil

Perfil muestra nombre y correo; Editar perfil permite únicamente cambiar correo. Nombre fijo, sin logo/datos profesionales. Mismo acceso y contraseña, con nuevo login tras confirmar el cambio. Desktop modal; mobile página de lectura y panel inferior de edición. Recuperación de contraseña desde login.

Cambio de correo conectado al servicio preparado, todavía pendiente de activación/prueba integrada. Ver 5.6.

## SCREENSHOTS RECOMENDADOS PARA EL MANUAL

- [ ] Navegación en orden Doctores → Administradores → Bitácora, desktop/mobile.
- [ ] Perfil propio: nombre de lectura/correo editable y retorno a Login tras cambiar correo.
- [ ] Baja ajena permitida y restricciones de baja propia/último Admin; exclusivamente cuentas ficticias.

- [ ] Login del personal y error de credenciales; desktop/mobile.
- [ ] Registro inicial Administrador solo con contraseñas, si existe cuenta de prueba autorizada.
- [ ] Doctores con tarjetas, buscador, encabezado sin campana y navegación lateral/inferior; desktop/mobile.
- [ ] Administradores con tarjeta propia y ajena; menú propio deshabilitado; desktop/mobile.
- [ ] Invitar administrador, resultado de envío y registro breve; desktop/mobile, sin credenciales visibles.
- [ ] Reenviar invitación de Admin pendiente con rol conservado y datos de lectura.
- [ ] Editar administrador ajeno: nombre/correo y error de correo duplicado; desktop/mobile.
- [ ] Eliminar administrador: confirmación y bloqueo por falta de otro Admin operativo; datos ficticios.
- [ ] Bitácora con registros ficticios y vacío; tabla desktop/mobile con scroll.
- [ ] Empty state «No has agregado ningún doctor».
- [ ] Menú de doctor completo y menú de doctor pendiente.
- [ ] Invitar doctor con campos y validaciones; panel desktop/inferior mobile.
- [ ] Resultado de invitación y enlace copiable, usando un enlace ficticio o invalidado.
- [ ] Envío en curso, fallo de correo con enlace manual y Reintentar envío; panel desktop/mobile.
- [ ] Reintento confirmado usando el mismo enlace y campos de lectura.
- [ ] Panel Reenviar invitación con nombre/correo de lectura, aviso de siete días y resultado; desktop y mobile. Usar enlace ficticio o invalidado.
- [ ] Editar doctor, nombre/correo, aviso de contraseña actual y error de duplicado; desktop/mobile (después de activar servicio).
- [ ] Confirmación Eliminar doctor, con datos ficticios; desktop/mobile si el wrapping cambia.
- [ ] Perfil propio de lectura y Cerrar sesión: modal desktop/página mobile.
- [ ] Editar correo propio con nombre fijo, validación y aviso de volver al login; modal desktop/panel inferior mobile.
- [ ] Recuperación: solicitud, nueva contraseña sin valores visibles y error de enlace vencido.

## INFORMACIÓN QUE NO PUDE CONFIRMAR DESDE EL CÓDIGO

1. ¿Quién prepara la primera cuenta de Administrador con acceso autorizado? Las siguientes se invitan desde Administradores cuando se activa el servicio.
2. ¿Qué canal de soporte atiende un cambio de correo administrativo interrumpido o un error al volver a iniciar sesión?
3. ¿Qué canal autorizado debe utilizar el Administrador para entregar manualmente un enlace si el correo no llega? La vigencia de siete días ya fue decidida.
4. ¿Quién autoriza la incorporación y baja de otro Administrador y cómo se documenta esa autorización fuera del sistema?
5. ¿Qué procedimiento de conservación de expedientes se debe seguir antes de dar de baja a un Doctor?
6. ¿Qué responsables deben autorizar una baja de Doctor?
7. ¿Cuál será la versión/ambiente habilitado para validar invitación, cambio de correo y baja antes de capturar el manual?
8. ¿Qué operaciones deben estar obligatoriamente representadas en Bitácora y cuánto tiempo se conservarán sus registros?
