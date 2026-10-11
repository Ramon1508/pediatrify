# P45 — Gestión de Administradores: análisis y verificación local

Revisión del 9 de octubre de 2026. Solo código local, cuentas sintéticas y emulador aislado. No se consultaron/modificaron cuentas reales, no se habilitaron servicios y no se desplegó. Esta revisión completa P45; no certifica todos los cierres anteriores ni el ambiente real.

## Decisiones confirmadas del usuario

- Admin gestiona **Doctores** y **Administradores** en áreas independientes, con el mismo patrón de tarjetas y formularios.
- Entrada principal: **Doctores**. Navegación: **Doctores → Administradores → Bitácora**, última.
- Solo Admin puede crear Admin o Doctor en backend. Doctor no puede obtener ese permiso manipulando la petición.
- Admin y Doctor pueden crear Asistentes en backend. La UI solo ofrece esa operación al Doctor.
- **Asistente creado por Admin:** asociado al Admin creador, exclusivamente para pruebas; sin agenda hasta vincularlo a un Doctor válido mediante mantenimiento autorizado. No se crea una agenda ficticia ni una UI de reasignación.
- No se permite baja propia; debe conservarse al menos un Admin activo con acceso completo. Una invitación pendiente no reemplaza ese acceso.
- Perfil propio de Admin: solo correo. Otro Admin puede gestionar nombre/correo ajenos desde el directorio.
- Presentación nueva/modificada: signals/computed. Formularios reactivos; no getters/métodos ordinarios para generar contenido en HTML.

## Qué había quedado a medias

| Área | Situación encontrada | Resultado local |
|---|---|---|
| Rutas/directorios | Existían `/app/admins`, títulos y filtrado parcial | Directorios protegidos en rutas/eventos, filtro por rol, tarjeta propia restringida, actualización por signals |
| Navegación | Entradas preparadas, con getters/método de presentación | Signals para menú/layout y reserva del espacio móvil; orden aprobado |
| Invitación | Admitía `admin` parcialmente | Rol fijo por directorio, autorización de servidor, registro Admin sin datos profesionales |
| Reenvío | Derivaba rol por invitador, ignorando destinatario Admin | Conserva rol del pendiente; nueva capacidad invalida la anterior, no duplica cuenta |
| Excepción Asistente de Admin | Registro suponía que el emisor siempre era Doctor | `issuerRole` protegido permite emisor Admin; asociación al creador y agenda bloqueada por validación de Doctor |
| Identidad Admin | Registro asignaba un `doctorId` propio | Nuevo principal Admin sin `doctorId`; Doctor mantiene propio; Asistente mantiene propietario |
| Edición ajena | Autorización de servidor no incluía destino Admin | Admin puede cambiar nombre/correo de otro Admin; incluso nombre sin cambio de correo usa operación autorizada |
| Baja | Servidor solo aceptaba Doctor/Asistente | Destino Admin, no baja propia, verificación de otro Admin operativo y conservación de Doctores creados |
| P01 | Directorio mínimo solo permitía Doctores para Admin | Prototipo permite Admin/Doctor; clientes no escriben perfiles, roles, autoridad ni control de bajas |

## Permisos implementados

| Actor | Crear Doctor | Crear Admin | Crear Asistente | Editar/borrar otro Admin | Borrarse |
|---|---|---|---|---|---|
| Admin | Sí | Sí | Solo backend de pruebas, asociado al Admin | Sí, baja requiere otro Admin operativo | No |
| Doctor | No | No | Sí, propio | No | No por esta operación |
| Asistente/Paciente | No | No | No | No | No por esta operación |

La autorización usa identidad de sesión y principal protegido de servidor, no `role` enviado como autoridad por el navegador. El rol solicitado en una invitación se valida contra el emisor autorizado y se guarda en documentos protegidos. Las solicitudes ajenas no pueden convertir a Doctor en Admin mediante reenvío/registro.

## Protección de la última cuenta administrativa

La reserva de baja revalida en una transacción al operador, su perfil, principal y ausencia de baja propia en curso. Para destino Admin consulta los otros perfiles y cuenta únicamente aquellos con:

- Registro completo y no pendiente.
- Vínculo Auth verificable por identificador en principal activo de rol Admin.
- Identificadores coincidentes, sin asociación `doctorId`.
- Sin baja reservada/terminada.

La transacción toca `staffAdminControl/roster` y escribe la reserva de baja. Ese documento compartido evita que reservas concurrentes ignoren cambios en el conjunto de administradores. Las lecturas ocurren antes de las escrituras. Tras reservar: bloquea/revoca acceso, invalida principal, limpia recursos propios, elimina Auth/perfil y conserva el tombstone para reintentos. Auth y Firestore no forman una única transacción; un fallo parcial deja el acceso bloqueado y permite reintentar.

La prueba real usa **Firestore Emulator STANDARD** en `127.0.0.1:8187`, proyecto ficticio `demo-lilcare-p01`: prepara ambos destinos válidos antes de iniciar las bajas concurrentes y confirma que solo una termina y queda una cuenta activa. Auth se simula; no se crearon cuentas externas.

Fuentes: `functions/src/staff-deletion.ts`, `staff-deletion-policy.ts`, `security/p45/admin-management.emulator.spec.mjs`. Contrato de transacciones: [documentación oficial de Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions). Gestión de acceso: [Firebase Admin Authentication](https://firebase.google.com/docs/auth/admin/manage-users).

## Alcance de la baja administrativa

Elimina el acceso/perfil del Admin y sus recursos de invitación/notificaciones propios. **Conserva** los Doctores que invitó, sus pacientes/citas y la Bitácora existente; `createdBy` histórico no se reasigna. No aplica la cascada clínica ni borrado de logos de Doctor a un Admin. El Asistente de pruebas asociado a un Admin tampoco se convierte automáticamente en Asistente de otro Doctor al dar de baja al Admin.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Angular, suite completa | **845 pruebas aprobadas, 68 archivos** |
| Node: políticas P01, baja P04, correo P09, invitaciones P13 y regresión P45 | **223 pruebas aprobadas** |
| Reglas P01 + transacciones reales P45 en emulador, archivos secuenciales | **46 pruebas aprobadas** |
| Compilación backend (`functions`: `npm run build`) | Correcta |
| Lint backend | Sin errores; tres warnings `any` en `functions/src/index.ts` existente |
| Compilación Angular de producción | Correcta; warnings existentes de presupuesto SCSS del calendario y dependencia Quill CommonJS |

La primera compilación se detuvo por descarga de Roboto bloqueada; la repetición con acceso a fuentes públicas completó correctamente. La CLI del emulador se utilizó desde caché con Java 21 temporal existente y configuración aislada: no se accedió al perfil de credenciales del usuario.

Comandos reproducibles (Node y dependencias autorizadas instaladas, Java 21 para emulador):

```powershell
# Desde functions
npm run build
npm run lint

# Desde la raíz
node --test security/p01/policy.spec.mjs security/p04/staff-deletion.spec.mjs security/p09/staff-email-change.spec.mjs security/p13/staff-invitations.spec.mjs security/p45/admin-management.spec.mjs
node node_modules/@angular/cli/bin/ng.js test --watch=false
node node_modules/@angular/cli/bin/ng.js build --configuration production

# Desde security/p01; los propios tests impiden usar un host/proyecto real
npx -y firebase-tools@latest emulators:exec --project demo-lilcare-p01 --only firestore --config firebase.emulators.json "node --test --test-concurrency=1 firestore.rules.spec.mjs ../p45/admin-management.emulator.spec.mjs"
```

## Activación pendiente: no confundir código listo con función disponible

P01 continúa como prototipo no integrado/desplegado. Los parámetros preparados conservan su valor predeterminado deshabilitado:

- `STAFF_INVITATIONS_ENABLED`
- `STAFF_EMAIL_CHANGE_ENABLED`
- `STAFF_DELETION_ENABLED`

**No deben activarse sobre las reglas abiertas actuales.** Antes de activar:

1. Integrar P01 con todos los escritores/lectores y proteger `securityPrincipals`, vínculos Auth/perfil, roles, propietarios, jobs, invitaciones, reservas de correo y `staffAdminControl`.
2. Ajustar el directorio al contrato de lectura: hoy la UI conserva `watchAllUsers()` sobre perfiles privados; el prototipo solo permite leer el propio `users` y listar proyecciones mínimas `staffDirectory`. Crear/sincronizar esas proyecciones y consultas autorizadas forma parte de P01, no de una mera activación de P45.
3. Aprovisionar al menos el primer Admin autorizado con Auth, perfil completo y principal activo coherentes. Dar un rol manual al perfil **no** otorga por sí solo autoridad de servidor. Para pruebas, un cambio de rol/propietario también debe sincronizarse con el principal protegido; el calendario exige un Doctor válido.
4. Revisar el plan de activación/despliegue y comprobar con cuentas sintéticas las operaciones permitidas/denegadas, envío de correo, reintentos y acceso tras cambio/baja.
5. Validar visualmente sidebar/barra inferior, invitación de Admin, edición ajena, tarjeta propia deshabilitada y mensajes antes de preparar screenshots/manuales.

Auditoría específica del cambio en reglas: `SECURITY_RULES_AUDIT.json`. Las reglas de producción no se modificaron. No se generó una migración ni se cambiaron flags/configuración.

## Archivos principales

| Área | Fuentes |
|---|---|
| Directorios | `src/app/pages/doctors/doctors.ts`, `.html`, `.spec.ts` |
| Navegación/layout | `src/app/app.routes.ts`, `src/app/shared/components/sidebar/`, `src/app/pages/doctor-layout/` |
| Invitación/registro | `src/app/pages/doctors/dialogs/invite-doctor-dialog/`, `src/app/core/services/staff-invitation.service.ts`, `functions/src/staff-invitations.ts` |
| Edición | `src/app/pages/doctors/dialogs/edit-doctor-dialog/`, `functions/src/staff-email-change.ts` |
| Baja | `src/app/pages/doctors/dialogs/delete-doctor-dialog/`, `functions/src/staff-deletion.ts`, `staff-deletion-policy.ts` |
| Regresión | `security/p45/admin-management.spec.mjs`, `admin-management.emulator.spec.mjs` |
| Política/reglas de laboratorio | `security/p01/policy.mjs`, `policy.spec.mjs`, `firestore.prototype.rules`, `firestore.rules.spec.mjs` |
