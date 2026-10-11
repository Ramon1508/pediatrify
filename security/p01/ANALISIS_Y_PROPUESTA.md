# P01 — Protección de datos: evidencia y propuesta revisable

## Estado y alcance

**Preparación local; P01 sigue abierto.** No se han desplegado reglas ni funciones, no se han cambiado cuentas, credenciales o datos reales y no se han integrado estos módulos en la aplicación. `firebase.json`, las reglas raíz y las dependencias de producción conservan su contenido. La carpeta `security/p01` constituye un prototipo independiente, no una protección activa.

El usuario eligió verificar producción y preparar una protección por rol, Doctor y familia. Este documento registra esa preparación; no es contenido para los manuales de usuario. Las irregularidades y decisiones siguen centralizadas en `PENDIENTES.md`.

**Actualización de alcance del 8 de octubre de 2026:** el usuario descarta la migración, recuperación o reasignación de datos antiguos; el Doctor comenzará la captura de información por primera vez próximamente. La integración se preparará para registros nuevos con propietario e identidad válidos. Se mantiene la necesidad de adaptar el cliente y establecer identidades autorizadas, proyecciones y controles de servidor. No se autoriza un borrado ni se ha comprobado que producción esté vacía.

## 1. Evidencia confirmada

- Inspección remota de solo lectura del alias Firebase por defecto: una base `(default)`, edición **STANDARD**, modo Firestore Native, ubicación `nam5`.
- Inspección del 4 de octubre de 2026, 15:47, America/Mazatlan: las reglas desplegadas de Firestore coinciden con las locales ignorando comentarios/espacios y contienen el permiso recursivo incondicional de lectura/escritura. La publicación inspeccionada se actualizó el 2 de octubre de 2026.
- El resultado, sin identificadores de cuentas, credenciales ni datos de negocio, está en `remote-inspection.json`. `inspect-remote.cjs` consulta solo metadatos/reglas y mantiene las credenciales dentro del cliente de Firebase CLI. Ninguna consulta a pacientes, personal o Firebase Auth users forma parte de esa inspección.
- El personal utiliza Firebase Authentication; el Paciente compara su clave contra documentos de pacientes en el navegador y mantiene una sesión local. Un cambio aislado a «requiere Firebase Auth» interrumpiría su acceso.
- Los IDs de `users` pueden ser los de invitación, diferentes del UID de Firebase Auth; existe `firebaseUid`. No es correcto asumir que `users/{request.auth.uid}` identifica siempre al usuario del negocio.
- Los documentos de pacientes incluyen datos básicos, credenciales de acceso y datos clínicos. Los registros clínicos incluyen las recetas/recomendaciones y datos que el portal no muestra. Ocultar campos en una vista no evita que lleguen al navegador si el documento completo es legible.
- Las notificaciones actuales son **un documento por destinatario**, con `recipientId`, `recipientType` y `read`; el prototipo toma ese modelo actual, no el modelo anterior de arrays.

Fuentes principales: `firestore.rules`, `.firebaserc` (alias sin copiar valores), `src/app/core/services/auth.service.ts`, `src/app/core/repositories/user.repository.ts`, `src/app/core/models/user.ts`, `src/app/core/models/clinical-record.ts`, `src/app/core/models/notification.ts`.

## 2. Permisos propuestos

Estos permisos se basan en los flujos por rol ya investigados. Son **la propuesta del prototipo**, no nuevos permisos activos.

| Operación | Administrador | Doctor | Asistente | Paciente/tutor |
|---|---|---|---|---|
| Perfil privado propio | Lectura/edición de correo propio | Lectura/edición profesional, correo fijo | Lectura/edición nombre y correo propios | Resumen familiar, sin reutilizar perfil de personal |
| Gestionar doctores | Sí, mediante servicio autorizado | No | No | No |
| Gestionar asistentes | No | Solo los suyos | No | No |
| Calendario | No | Su Doctor | Doctor asociado | Sus hijos y ocupación sin identidades ajenas |
| Crear/reagendar/cancelar cita | No | Su agenda | Agenda asociada | Hijos vinculados; sujeto a permiso del Doctor y disponibilidad |
| Alta básica de paciente | No | Sí, con propietario derivado de identidad | Sí, con propietario Doctor asociado | No |
| Editar/eliminar paciente existente | No | Propietario | No | No |
| Leer/modificar clínica, antecedentes y vacunas | No | Propietario | No | No |
| Leer receta/recomendaciones publicadas | No | Propietario | No | Solo familia, documento vigente y fuente existente/actual |
| Configurar días, segmentos y duración | No | Sí | Sí | No |
| Permitir reservas del Paciente | No | Sí | **No**, incluso si manipula la solicitud | No |
| Impresión clínica y configuración | No | Propietario | No | Solo contenido publicado autorizado |
| Consultar/rotar clave del Paciente | No | Propietario | No | No; recupera acceso mediante consultorio |
| Notificaciones | Sin bandeja | Propias | Propias | Destinatarios de su familia y Doctor |
| Asignar roles, asociaciones o membresías | Administración confiable en servidor | No desde el cliente | No | No |

El servidor deriva propietario, rol de invitado y actor; el navegador no los decide. El Administrador administra datos de gestión del Doctor mediante una proyección/operación autorizada, sin recibir su documento privado completo ni datos clínicos.

## 3. Inventario de acceso actual y transición necesaria

Firestore no usa las reglas como un filtro posterior a una lectura global. Las consultas deben expresar un alcance permitido. El Admin SDK evita las reglas: las operaciones de servidor necesitan sus propias comprobaciones de identidad, permisos y datos.

| Fuente / acceso actual | Uso actual | Propuesta necesaria antes de desplegar |
|---|---|---|
| `UserRepository.getUser(id)`, `watchUser(id)` | Perfil, horarios, impresión | Perfil privado propio; horarios en `schedules`; impresión/profesión por operación específica autorizada |
| `getUserByEmail`, `getUserByFirebaseUid` | Encontrar perfil tras login | Resolver identidad en servidor; el cliente obtiene `securityPrincipals/{Auth UID}` y luego su perfil por ID de negocio |
| `getAssistantsByDoctor`: role=assistant, filtro createdBy en cliente | Destinatarios y asociados | Consulta de servidor para notificar; directorio con filtros role+createdBy para UI |
| `watchAllUsers()` | Directorio de doctores/asistentes y rama de calendario | `staffDirectory`, filtros role/createdBy; eliminar consulta privada global |
| `InvitationRepository.findPendingUserByEmail` | Setup sin sesión | Resolver/consumir invitación en servidor con vínculo verificable y rol original; no lectura pública de `users` ni elección de rol enviada por cliente |
| `PatientRepository.getPatient`, `watchPatient` | Expediente y portal | Doctor: privado propio; Asistente: `patientDirectory`; familia: `patientPortal` |
| `getAllPatients`, `getPatientByEmail`, `watchAllPatients` | Directorio/selector y detecciones | DoctorId explícito; ningún padrón global en el navegador |
| `getPatientsByDoctor`: doctorId=... | Directorio, familia, cascada | Doctor: privado propio; Asistente: directorio básico; familia resuelta por servidor, no lectura de todos los niños del Doctor |
| `findPatientsByLoginEmail`: email=... y secondaryEmail=... | Login, agrupación familiar, avisos | Ejecutar en servidor; consulta de credenciales protegidas y coincidencia familiar autorizada. Nunca devolver OTP a quien inicia sesión |
| `getChildrenGroup`: todos del Doctor y filtro correo en cliente | Hijos del portal | Membresías verificadas y resúmenes por IDs autorizados; conservar nombre, edad y nombres de padres/tutores visibles |
| `AppointmentRepository.getAppointment`, `watchOneAppointment`, `getByPatient` | Detalle, foco, cascada | Documento propio de agenda o niño familiar; conservar pertenencia al Doctor |
| `getAllByDoctor`, `getAppointmentsByDoctor`, `watchAppointmentsByDoctor` | Agenda | Personal: doctorId canónico. Familia: patientId+doctorId, más ocupación anonimizada separada |
| `getAllAppointments`, `watchAllAppointments` | Métodos generales/legacy | No exponer consultas globales al cliente; no usar como alternativa a permiso denegado |
| `watchAppointmentsByUpdatedBy`: updatedBy=email | Combinar citas con agenda | Sustituir por propiedad canónica. Un correo de edición no otorga acceso ni propiedad |
| `ClinicalRecordRepository.get`, `getByPatient`, `watchByPatient` | Historial, impresión y portal | Doctor por paciente propietario; portal solo `patientDocuments` publicados, no registros completos |
| `seedTestRecords` | Método preparado de fixtures clínicos | No disponible como acción pública; privilegios mínimos también para datos de prueba |
| `PrintSettingsRepository`: users/{doctorId}.printSettings | Impresión | Lectura propia del Doctor; cambio mediante operación validada `printing.update` |
| `NotificationRepository.getPage`: recipientId, read opcional, orderBy(createdAt desc), limit, startAfter | Bandeja/paginación | Añadir doctorId canónico a documento y consultas. Mantener filtro, cursor y estado por destinatario |
| `watchUnreadCount`, `watchForRecipient` | Conteo y novedades | Mismos filtros de destinatario+Doctor; no contar bandejas ajenas |
| `markAllRead`, `markAllCancelledRead` | Marcado masivo con cursor; type=cancelled/read=false | Solo notificaciones propias; escritura exclusiva del booleano `read=true` |
| `createMany` en cliente | Generar avisos a participantes | Generación de servidor posterior a una operación de cita autorizada; actor/destinatarios calculados allí |
| `AuditRepository.log`, `watchAll` | Bitácora preparada y registros de cambios | Auditoría de servidor; autor inalterable; no creación ni lectura global desde SDK cliente |
| `SettingsDialog.setDoc(users/{target})` | Horarios | Endpoint validado de agenda; Asistente no puede incluir allowPatientScheduling en solicitud |
| `InviteDoctorDialog.setDoc(users/{id})` | Alta pendiente | Endpoint de invitación; Admin→Doctor y Doctor→Asistente; ID y asociaciones del servidor |
| `CascadeService` | Borrados desde cliente | Operación del servidor con permisos, inhabilitación/revocación inicial y eliminación consistente |
| `emailCounter/daily` y Cloud Functions de correo | Cuotas y correo | Contadores privados, transacciones de servidor; cada envío de datos de negocio requiere validar actor y destinatario |

Además se revisaron `calendar.ts`, `doctors.ts`, `setup-profile.ts`, `patient-patients`, `patient-history-view`, `print-preview`, `impresion`, `profile-dialog`, reglas/guards y los modelos. Las funciones de correo existentes no constituyen por sí solas la nueva capa de autorización.

**Actualización de producto P08/P09/P10 (9 de octubre de 2026):** Admin edita únicamente correo propio; Asistente nombre/correo propios; Doctor conserva perfil profesional y correo propio fijo. Política candidata: `profile.update` permite nombre propio de Asistente/perfil profesional de Doctor; `profile.email.change` permite correo propio Admin y nombre/correo Asistente. Cambio de correo mediante callable `updateStaffEmail`, mismo UID y gate false por defecto. Antes de activar: autoridad/jobs/reservas privados, coordinación de todos los escritores/registro/bajas, unicidad y pruebas integradas. Nombre solo aún usa escritura directa pendiente de adaptar en P01. No gestión de otros Administradores (P45).

## 4. Modelo del prototipo

`firestore.prototype.rules` documenta las colecciones necesarias. Las escrituras de negocio se niegan desde el cliente y se reservan a una capa de servidor con autorizaciones equivalentes a `policy.mjs`. Los campos de entrada se limitan, tipan y acotan tanto al crear como al actualizar; al actualizar pacientes/registros también se verifica el estado resultante con los campos obligatorios.

- **`securityPrincipals/{authUid}`:** autoridad creada por administración/servicio confiable: rol, ID de negocio, Doctor asociado, estado activo. El usuario no puede crearse autoridad, editar su rol ni vincularse a otro Doctor. La función `authenticateRequest` verifica el ID token, su revocación y el vínculo de UID contra esta autoridad.
- **Familia:** `familyAccess/{authUid}/patients/{patientId}` escrito solo por servidor. Las reglas también comprueban el Doctor y el correo actual del paciente. Una membresía obsoleta no mantiene acceso si se retiró el correo familiar.
- **Sesión del Paciente:** `patient-login.mjs` conserva correo y clave como entrada visible, pero los valida en servidor contra un verificador scrypt protegido. Incluye un limitador obligatorio como dependencia y genera un token personalizado de Firebase con versión de sesión. El navegador intercambia el token con `signInWithCustomToken`; el objeto de sesión local deja de ser prueba de identidad.
- **Revocación:** las reglas comparan la versión firmada de la sesión familiar con la versión del principal. La integración debe incrementarla/inactivar el principal al revocar acceso o regenerar credenciales. No depender solo de caducidad de tokens ni de cerrar el diálogo.
- **Datos mínimos:** `patientDirectory` conserva lo que necesita el personal para agendar sin OTP/clínica; `patientPortal` conserva nombre, nacimiento y padres/tutores; `appointmentSlots` solo tiempos ocupados. Las funciones de proyección se prueban contra inclusión accidental de credenciales/diagnóstico/vacunas.
- **Publicaciones:** cada receta/recomendación tiene su documento propio, expiración como timestamp y `sourceUpdatedAt`. Cambiar/eliminar su fuente invalida una publicación anterior; la regla también verifica que fuente y publicación correspondan al mismo paciente.
- **Notificaciones:** conservan fan-out y `read` por destinatario; añaden Doctor canónico. El cliente solo puede marcar una propia como leída; no puede crear eventos, mover destinatarios, sobrescribir contenido o reiniciar lectura.
- **Operaciones de administración:** `policy.mjs` contiene permisos y validación para perfil profesional, invitación/edición/baja de personal, alta/edición/baja clínica de pacientes, administración de claves, registros clínicos, citas, horarios e impresión. Estos módulos no son endpoints desplegados ni adaptadores completos del Admin SDK.

La representación clínica privada puede conservar los datos que el Doctor está autorizado a ver. Si se conserva la visualización de la clave actual del Paciente, su lectura debe permanecer exclusiva del Doctor propietario. El verificador de login y la representación usada para entregar/consultar acceso deben actualizarse consistentemente en servidor; el prototipo no borra ni convierte credenciales reales.

## 5. Límites y decisiones que la integración debe resolver

1. **No es compatible con desplegar solo este archivo de reglas.** La aplicación actual escribe directamente y necesita consultas distintas. Sustituir ahora las reglas raíz bloquearía operaciones legítimas. La preparación mantiene el prototipo fuera de `firebase.json` deliberadamente.
2. Hay que implementar adaptadores confiables de persistencia, emisión de tokens, activación de principal, pertenencia familiar, limitación de intentos, endpoints autorizados y migración del cliente. Las dependencias inyectadas del prototipo son contratos de servidor; no aceptar esas dependencias/contextos desde una solicitud del navegador.
3. La autorización y el commit deben ejecutarse dentro de una transacción o con precondiciones de versión: evitar aprobar un propietario/permiso y escribir después de que haya cambiado. El módulo puro de permisos no reemplaza esa transacción.
4. Los horarios, horas pasadas y ocupación deben comprobarse nuevamente con reloj/zona horaria de servidor y transacción. Las pruebas de P01 comprueban alcance y permiso de reserva, **no** todo el algoritmo actual de disponibilidad ni concurrencia de reservas. No añadir una aprobación de cita inexistente en la UI.
5. Antes de cargar publicaciones, acordar zona horaria para convertir las fechas civiles de visibilidad en instantes. Actualmente el código usa el día local del navegador; el prototipo requiere un instante confiable. Una vigencia vacía actualmente significa sin límite: deberá representarse con una política explícita de publicación, no convertirla silenciosamente en expiración inmediata.
6. Preservar la visualización autorizada de recetas/recomendaciones, su formato y los flujos de impresión. Sanear HTML antes de publicarlo y no entregar el diagnóstico/medidas por reutilizar un registro completo. El prototipo no implementa sanitización de HTML ni una migración de todos los formatos de impresión.
7. Validar los vínculos existentes de Firebase UID↔usuario, rol, `createdBy`, Doctor de paciente/cita. No vincular permisos únicamente por un correo enviado por el cliente ni por coincidencias no verificadas. La inspección remota no evaluó documentos reales ni integridad histórica de estos vínculos.
8. Los datos antiguos están fuera de alcance por decisión del usuario: no se preparará su migración ni una excepción de permisos para conservarlos accesibles. Los nuevos pacientes/citas deberán guardar el Doctor propietario correcto. La adaptación del cliente para usar identidades y consultas autorizadas sí sigue siendo necesaria.
9. Los límites de entrada son propuestas conservadoras de servidor, **no** validaciones actuales de la interfaz: nombres/campos básicos hasta 300 caracteres, texto clínico hasta 10 000, documentos hasta 50 000, hasta 12 segmentos por día, hasta 100 candidatos/hijos por login y límites numéricos acotados. Deben contrastarse con datos de prueba y decisiones del producto antes de activar.
10. Al deshabilitar/eliminar Doctor, revocar su autoridad y la de asistentes dependientes antes del borrado. Al retirar correo familiar o rotar acceso, revocar versiones/membresías correspondientes. Implementar acciones sobre Firebase Auth en servidor según la baja definida; no confiar en que borrar Firestore elimine una cuenta Auth.
11. Revisar permisos IAM del servicio: las reglas del cliente no limitan al Admin SDK. No registrar credenciales/tokens ni devolver errores internos que contengan solicitudes completas.
12. Se inspeccionó la existencia/metadatos de la publicación de Storage; **no se afirma una auditoría completa de sus reglas**. Los logos, URLs de descarga y su posible lectura mediante token necesitan revisión propia antes de afirmar protección integral de todos los recursos.
13. Un recurso ya descargado, impreso o guardado por un destinatario autorizado no puede recuperarse mediante reglas de lectura posteriores. El alcance de expiración es acceso nuevo al sistema, no borrado de copias externas.

## 6. Secuencia de integración propuesta

1. Revisar esta matriz y los contratos con datos sintéticos. Conservar la configuración actual fuera del prototipo.
2. Crear un entorno de ensayo con datos sintéticos y preparar un procedimiento de recuperación del despliegue. No incluir migraciones ni borrados de datos antiguos en este trabajo.
3. Implementar servidor e identidades confiables; preparar scripts con modo diagnóstico por defecto, salida de conteos y sin PII/secretos. Establecer la autoridad inicial del Administrador por un responsable autorizado, sin endpoint público de autoasignación.
4. Preparar la generación de proyecciones/directorios/publicaciones y vínculos autorizados para registros nuevos. Adaptar las consultas enumeradas. Evitar que el cliente pueda modificar los campos derivados del servidor.
5. Cambiar login del Paciente a validación de servidor+Firebase Auth, preservando los controles visibles. Actualizar manejo de sesión/caché/logout del personal y Paciente para que un token familiar no sea tratado como Doctor.
6. Migrar escrituras a endpoints y generar auditoría/notificaciones/proyecciones de forma consistente. Reservar la escritura directa de `read=true` a las notificaciones propias. P04/P05 añadieron localmente `deleteStaff`, deshabilitada por defecto, con cascada a Asistentes y recursos privados: integrar su directorio confiable y `staffDeletionJobs`, denegar acceso cliente a los jobs y hacer que todo escritor/registro/aviso/upload compruebe las bajas activas/completadas del usuario y del Doctor propietario antes de crear accesos o recursos. Invalidar también acceso/proyecciones familiares de pacientes borrados y preparar permisos/reglas de Storage. No habilitarla con reglas abiertas; detalles en `security/p04/IMPLEMENTACION_Y_ACTIVACION.md` y `security/p05/IMPLEMENTACION_Y_VERIFICACION.md`.
7. Preparar índices del archivo `firestore.prototype.indexes.json`; el emulador no acredita que esos índices estén creados en producción.
8. Probar todos los flujos de los cuatro roles, desktop/mobile, con accesos permitidos y denegados. Incluir login/setup/invitaciones, email, horarios, alta embebida, historial, recetas/impresión, avisos y bajas. Cualquier estado nuevo renderizado en Angular debe usar signals/computed, conforme a la instrucción del usuario.
9. Someter el conjunto compatible a revisión. Solo después autorizar despliegue coordinado de servidor, datos, cliente y reglas; nunca declarar resuelto P01 por ocultar controles o por aprobar únicamente estas pruebas.

## 7. Pruebas y reproducción

Requisitos: Node ≥22, Java 21 en PATH para el emulador, acceso a npm/descarga del emulador. Dependencias separadas del proyecto Angular. Java usado para la verificación fue portable y temporal; no se instaló globalmente.

Desde `security/p01`:

```powershell
npm ci --ignore-scripts
npm test
npm run test:rules
```

`npm test` verifica el núcleo de permisos, sus validadores, la redacción de datos y el protocolo de acceso del Paciente. `npm run test:rules` ejecuta reglas reales en Firestore Emulator usando exclusivamente `demo-lilcare-p01`. El archivo de pruebas impide ejecutarse con un host distinto de `127.0.0.1:8187` o con otro proyecto explícito. Identidades, correos y campos son sintéticos; claves de pruebas se generan al ejecutar y nunca corresponden a usuarios reales.

Verificación final del 4 de octubre de 2026: **79 pruebas aprobadas, 0 fallos y 0 omitidas**: 37 de permisos/protocolo de autenticación y 42 de Security Rules en el emulador. También se comprobó que esta preparación no introduce diferencias nuevas en `src/app`, reglas/índices raíz, `firebase.json`, `package.json` ni `functions`. Estos resultados no acreditan integración de la aplicación ni protección activa en producción.

Las pruebas cubren caminos permitidos además de rechazo de acceso: dos doctores, asistentes separados, dos hijos con correo principal/secundario, niño ajeno, mismo correo en otro Doctor, Administrador y visitante anónimo. El emulador validó la sintaxis; los fallos de permiso esperados forman parte de las pruebas negativas.

## 8. Auditoría adversarial del prototipo

| Vector | Resultado / prueba |
|---|---|
| Consulta pública de pacientes/perfiles/registros | Denegada; visitantes y usuarios sin principal confiable |
| Lectura/escritura de otro Doctor | Denegada; propietarios en reglas y núcleo de permisos |
| Crear válido y actualizar con datos inválidos | Denegado; cadenas enormes, campos obligatorios vacíos, tipos y atributos no declarados |
| Falsificar propietario al crear/actualizar | Rechazado; propietario derivado del principal, IDs y referencias no editables |
| Cambiar rol, Firebase UID o creador | Rechazado; autoridad solo de servidor y entradas con lista cerrada |
| Modificar timestamps/autor/notificación | Denegado; solo read=true puede cambiar en documento existente propio |
| Asistente cambia permiso de reservas | Rechazado por núcleo de servidor; escritura directa también denegada |
| Familia usa correo compartido para otro Doctor | Denegado; Doctor y membresía comprobados contra datos actuales |
| Familia accede a clínica privada | Denegado; solo resumen/publicación permitida |
| Publicación vencida, fuente borrada o modificada | Denegada; tiempo, existencia, paciente y versión de fuente |
| Aumentar contadores o crear eventos falsos | Denegado desde cliente; generación reservada al servidor |
| Reanimar una cita cancelada/deshabilitada con update | Rechazado por núcleo de servidor |
| Lista/array/map gigantes o mal tipados | Rechazados; segmentos y todas las dosis se inspeccionan y acotan |
| Borrar Doctor y usar un Asistente huérfano | Denegado para agenda/directorio; requiere existencia del Doctor activo |
| Token familiar con versión anterior | Denegado incluso antes de expirar el token |
| Consultas amplias de UI legacy | Denegadas deliberadamente; se prueban sus sustitutos con alcance correcto |
| Saltarse el núcleo usando Admin SDK | **No cubierto por reglas**; integración/IAM/transacciones aún deben implementarse y probarse |

Los resultados son del entorno sintético y del prototipo; no se ejecutaron ataques contra datos de producción.

## Referencias oficiales usadas

- [Pruebas de reglas con Firestore Emulator](https://firebase.google.com/docs/firestore/security/test-rules-emulator).
- [Comportamiento de Security Rules](https://firebase.google.com/docs/rules/rules-behavior).
- [Tokens personalizados de Firebase Authentication](https://firebase.google.com/docs/auth/admin/create-custom-tokens).

Declaración de alcance del prototipo exigida por la guía aplicada:

> I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for role-scoped and Doctor-scoped access, trusted family membership, private clinical data, and immutable notification ownership. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

Esta declaración describe el objetivo del prototipo. **La base actualmente desplegada conserva las reglas abiertas constatadas; estos archivos no la protegen hasta completar la integración y el despliegue coordinado.**
