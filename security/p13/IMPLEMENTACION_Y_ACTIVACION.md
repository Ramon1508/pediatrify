# P13 — Invitaciones únicas, caducidad y registro controlado

Implementación local autorizada: opción 1. Fecha: 9 de octubre de 2026. No se han desplegado Functions, reglas o configuración, ni utilizado cuentas, credenciales o datos reales.

## Comportamiento decidido

- Administrador invita Doctores; Doctor invita sus propios Asistentes. Este cambio no implementa el directorio de Administradores de P45.
- Nombre y correo se normalizan/validan; no se crea otro pendiente si el correo ya existe en el directorio, Firebase Auth o una reserva de correo del servidor.
- El enlace contiene una credencial aleatoria de 256 bits en el fragmento `#invitation=…`; dura exactamente siete días desde su emisión, según hora del servidor.
- Reenviar desde el directorio abre el mismo panel de invitación, con nombre/correo de lectura. Confirmar emite un enlace nuevo, invalida el anterior y conserva el ID de la cuenta pendiente. Si cambió el correo, el enlace previo también se invalida y debe reenviarse al correo actualizado.
- Reintentar envío tras un fallo de correo usa el enlace ya emitido; no crea usuario ni renueva vigencia. Es distinto de Reenviar invitación desde el directorio.
- El registro consume la invitación solo cuando cuenta, perfil y autoridad protegida quedan confirmados. No permite cambiar nombre, correo, rol, propietario o UID desde el formulario.
- No se borra ni recrea una cuenta Auth existente para resolver duplicados. Una cuenta ajena bloquea la operación.
- Doctor completa campos profesionales y contraseña; Asistente solo contraseña/confirmación. El logotipo del Doctor invitado se configura desde Perfil después de iniciar sesión; el registro público no sube archivos ni escribe ajustes de impresión.
- Formulario, estados, errores y botones nuevos usan signals/computed. Botón bloqueado con formulario inválido, intacto o petición activa; confirmación de contraseña muestra error en el campo.
- Enlaces antiguos por `?email=` se rechazan; no hay migración requerida. La finalización de un perfil existente autenticado se conserva y requiere coordinación de permisos al integrar P01.

## Endpoints preparados y activación

`manageStaffInvitation`, `inspectStaffInvitation` y `redeemStaffInvitation` se exportan desde `functions/src/index.ts`. El parámetro `STAFF_INVITATIONS_ENABLED` es **false por defecto**. No hay retorno al alta directa desde navegador si el servicio falla o está deshabilitado. La aplicación preparada requiere activar/desplegar estos endpoints para realizar nuevas invitaciones.

**Prerequisito obligatorio de activación: P01.** Las reglas actuales abiertas permiten alterar autoridad y metadatos del servidor, por lo que no se puede acreditar protección de producción solo por estas Functions. Antes de habilitar:

1. Proteger contra todo acceso de cliente las colecciones privadas enumeradas abajo, incluidos `securityPrincipals`, jobs y reservas. Los metadatos deben crearlos exclusivamente procesos autorizados del servidor.
2. Desautorizar alta, vinculación Auth, cambio de rol/propietario, finalización de pendientes y cualquier escritura alternativa que eluda el registro por token. Coordinar el flujo autenticado existente para perfiles incompletos; no dar acceso clínico a una identidad provisional/inactiva.
3. Coordinar P04/P05 y P09/P10, todos los escritores de perfiles y el cierre/revocación de sesiones con la autoridad protegida. Los callables ahora comprueban bloqueos de invitación/registro, baja y cambio de correo.
4. Validar con usuarios sintéticos en un proyecto autorizado la emisión, correo real, fragmento en enlaces del proveedor de correo, registro, permisos por rol y expiración. Los tests locales usan adaptadores en memoria, no prueban Rules/Auth/SMTP desplegados.
5. Desplegar coordinadamente cliente, Functions y reglas; habilitar el parámetro solo después de comprobar lo anterior. No se realiza despliegue en este trabajo.

El control de siete días y consumo es definitivo en el servidor preparado; su garantía depende de proteger todos sus metadatos y rutas alternativas.

## Persistencia privada

| Colección | ID / contenido | Tratamiento |
|---|---|---|
| `staffInvitations` | ID de negocio; UID Auth reservado aleatorio, destinatario, rol/creador, emisor, hash del token, caducidad en milisegundos, estado, lease e identificador de registro | Nunca legible/escribible por cliente; no contiene contraseña ni token en claro |
| `staffInvitationTokens` | SHA-256 del token; referencia a ID de negocio | Se elimina al rotar, cambiar correo pendiente o eliminar; tras consumo conserva acuse idempotente limitado |
| `staffInvitationIssueJobs` | SHA-256 del UID Auth del operador + ID de operación; ID de negocio y datos del intento | Reintento conserva cuenta pendiente; no almacena token en claro |
| `staffEmailReservations` | SHA-256 del correo normalizado; titular/tipo/operación | Compartida con cambio de correo; evita altas paralelas. Liberada tras registro confirmado o baja; trasladada al editar correo pendiente |
| `staffInvitationRateLimits` | SHA-256 de IP obtenida del servidor; ventana y contador | Ambos endpoints públicos comparten límite de 30 llamadas / 5 minutos por dirección; no guarda IP en claro |
| `securityPrincipals` | UID Auth; identidad de negocio, rol, Doctor y estado activo | Durante provisión permanece inactiva; activación atómica con perfil y consumo |

Las contraseñas se transmiten de forma transitoria a Firebase Auth desde el servidor y no se escriben en Firestore ni se registran en logs. El enlace sí se entrega al correo y se muestra para copiar: es una credencial de acceso al registro; usar solo enlaces ficticios o invalidados en screenshots/manuales. El fragmento evita enviarlo como query en la petición inicial a Hosting; no lo oculta del navegador, destinatario, correo o captura de pantalla.

No se configura TTL ni limpieza periódica en este cambio. Caducar un enlace impide su uso, pero no elimina el pendiente ni libera automáticamente su reserva de correo. Jobs y contadores pueden requerir una política de retención posterior; conservar acuses necesarios para reintentos. La baja preparada limpia invitación, lookup, jobs de emisión y reserva propia, sin recorrer otros usuarios.

## Consumo, reintentos y coordinación

1. Emisión autenticada comprueba token Firebase con revocación, principal protegido, perfil completo y ámbito. El cliente no define rol/UID/Doctor.
2. Inspección pública exige token aleatorio válido, hash vigente, pendiente actual, emisor autorizado, plazo y ausencia de baja/cambio de correo.
3. Registro valida contraseña y campos por rol; reserva una operación y prepara autoridad inactiva antes de crear Auth con UID previamente reservado y `disabled: true`.
4. Revalida autoridad/lease antes de habilitar Auth y otra vez antes de activar el principal, completar perfil y consumir token en la transacción final.
5. Auth y Firestore no comparten transacción. Un fallo parcial conserva metadata de provisión y libera lease para reintentar sobre el mismo UID. La cuenta puede haber quedado habilitada, pero el principal continúa inactivo hasta confirmar: esto requiere P01 para bloquear todo acceso alternativo.
6. Un reintento idéntico del registro confirmado responde positivamente sin cambiar contraseña o volver a crear cuenta. Otra operación con enlace consumido se rechaza. El acuse original también exige autoridad/plazo vigentes; no es una autorización indefinida.
7. Registro incompleto `redeeming` bloquea cambio de correo y baja incluso con lease liberado. Se debe terminar el registro o reenviar una invitación autorizada cuando no exista lease activa para recuperar el mismo UID; no hay limpieza destructiva automática de provisiones interrumpidas.
8. Reenvío autorizado conserva UID reservado y provisión conocida; puede recuperar una operación interrumpida, renovando el token y plazo. Un enlace vencido no puede registrar; el directorio permite emitir uno nuevo para el mismo pendiente.

La emisión idempotente conserva el pendiente pero puede rotar el token en un reintento de red. En el mismo panel, Reintentar envío no vuelve a emitir. Confirmaciones de SMTP no demuestran recepción/lectura y una respuesta perdida puede producir varios correos con el mismo enlace.

## Verificación local

- Backend: `npm run build` y `npm run lint` dentro de `functions`.
- Pruebas sintéticas: `node --test security/p13/staff-invitations.spec.mjs security/p09/staff-email-change.spec.mjs security/p04/staff-deletion.spec.mjs security/p01/policy.spec.mjs security/p01/patient-login.spec.mjs`.
- Aplicación: `npx ng test --watch=false` y `npx ng build --configuration development`.
- Cobertura de casos: gates cerradas; autoridad/revocación; payload malicioso; duplicados y reservas; paralelo serializable; siete días/borde exacto; rotación; único consumo; cuenta Auth ajena; creación sin borrado; provisión parcial; fallo de acuse/transacción final; cambio de correo pendiente; limpieza de baja; límite público; UI, validaciones, signals, mensajes y envío/reintento.
- Adaptador Firestore de pruebas serializa transacciones y comprueba lecturas antes de escrituras; no sustituye una prueba integrada contra Firestore Emulator ni Auth real.

Fuentes: `functions/src/staff-invitations.ts`, `staff-email-change.ts`, `staff-deletion.ts`; `src/app/core/services/staff-invitation.service.ts`, `auth.service.ts`; `src/app/pages/setup-profile/`; `src/app/pages/doctors/doctors.ts`, `dialogs/invite-doctor-dialog/`; pruebas `security/p13` y specs asociados.

Resultado de verificación: **211 pruebas sintéticas de backend/permisos aprobadas**; **608 pruebas de Angular en 56 archivos aprobadas en suite completa**. La primera ejecución de Angular tuvo un timeout del test previo de título de horarios; la repetición aislada de horarios/invitación (46 pruebas) y la repetición completa aprobaron sin modificar esa prueba. Verificación final: 31 pruebas aprobadas de registro/correo; distingue caducidad indicada por servidor de timeout de red. Setup existente guarda defaults de impresión mientras la sesión sigue activa, antes de completar perfil/cerrar sesión; el registro público no escribe esos ajustes. Compilación Functions y Angular desarrollo correctas; lint sin errores, con tres warnings anteriores de tipos en index. Sin prueba visual/correo real ni despliegue.
