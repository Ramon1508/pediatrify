# P04 — Baja definitiva de personal

Decisión del usuario: **opción 1**, eliminar también el acceso de Firebase Authentication y revocar sus sesiones. Preparación local del 8 de octubre de 2026. **Sin despliegue, sin bajas reales y sin migraciones de datos antiguos.**

## Estado

**IMPLEMENTADO LOCALMENTE / ACTIVACIÓN PENDIENTE DE P01.** El navegador delega la baja en `deleteStaff`; se retiró su antiguo borrado directo de personal. El endpoint está deshabilitado por defecto mediante el parámetro servidor `STAFF_DELETION_ENABLED`, cuyo valor inicial es `false`. No se creó ni modificó ningún archivo de entorno.

No publicar únicamente el nuevo frontend: la función debe desplegarse de forma coordinada. Sin endpoint desplegado la baja no termina; con el parámetro deshabilitado muestra un error de operación no habilitada y no borra datos. No existe alternativa insegura que continúe borrando desde el navegador.

## Autorización y vínculo de cuenta

- El cliente envía **únicamente** `{ userId }`, el identificador del perfil de negocio. No puede suministrar rol, Doctor propietario, email ni UID de Auth.
- Se verifica el ID token con comprobación de revocación. Se consulta el principal servidor de P01, `securityPrincipals/{authUid}`, y se contrasta con el perfil completo/no pendiente del operador. La sesión guardada en el navegador no concede permiso.
- Administrador elimina exclusivamente Doctor; Doctor elimina exclusivamente su Asistente asociado. Asistente/Paciente no pueden ejecutar la baja. Tampoco se elimina al operador mismo ni su cuenta Auth. La gestión futura de otros Administradores de P45 **no está autorizada todavía por esta política**.
- Para una cuenta ya creada se exige el vínculo protegido entre perfil, `firebaseUid`, principal, rol y Doctor asociado. UID de negocio y UID de Auth pueden ser diferentes. No se utiliza una búsqueda por email como sustituto de un vínculo faltante.
- Invitación pendiente sin Auth: se permite retirar el perfil solo si sigue pendiente, no está completado y no existe una cuenta Auth con ese correo. Si existe un acceso sin vínculo verificado, se bloquea la operación en lugar de eliminarlo por email.

**Dependencia real:** hoy los roles/documentos de Firestore no son autoridad segura bajo las reglas abiertas de P01. El parámetro deshabilitado evita ejecutar esta autoridad provisional antes de su protección. Activarlo con esas reglas sería inseguro.

## Orden y alcance

1. Se reserva la operación en `staffDeletionJobs/{userId}` mediante transacción, con identidad destino fija y exclusión temporal de ejecuciones simultáneas. P05 añadió preparación y reservas de los Asistentes del Doctor, con vínculo `parentUserId`.
2. Se deshabilita la cuenta Auth y se revocan sus refresh tokens, si existe acceso vinculado; con P05 también los de los Asistentes reservados.
3. Se desactivan sus principales protegidos (`active: false`) antes del borrado de recursos.
4. Doctor: se eliminan sus pacientes, registros clínicos por paciente y citas asociadas. Se incluyen sus citas deshabilitadas. Asistente: no se eliminan pacientes ni datos clínicos; solo citas que tengan su identificador propio como `doctorId`, si las hubiera. Las citas de la agenda del Doctor se conservan al eliminar un Asistente.
5. Se elimina la cuenta Auth original.
6. Una transacción final elimina el perfil y marca la operación completada. La UI muestra éxito únicamente tras recibir confirmación completa del servidor.

Las escrituras de borrado se dividen en lotes de hasta 400 documentos. Los pacientes se borran después de sus registros/citas, para que un fallo no impida localizar los hijos pendientes al reintentar. No hay una transacción única que abarque Auth y Firestore.

**Ampliación posterior autorizada en P05:** la misma callable elimina los Asistentes vinculados al Doctor, sus Auth/perfiles y recursos privados; limpia logos/bandejas y avisos de citas eliminadas. Horarios e impresión desaparecen con el perfil. Detalle actual: [P05](../p05/IMPLEMENTACION_Y_VERIFICACION.md). Las proyecciones/sesiones familiares restantes siguen pendientes de integrar en P01. La baja individual de Asistente conserva citas del Doctor; no se preparan migraciones de citas antiguas.

## Fallos, concurrencia y reintentos

- La UI usa signals/computed para título, botón y estado de proceso. Durante la petición deshabilita ambos botones, bloquea Escape/backdrop y rechaza una segunda confirmación.
- Si un paso falla, no anuncia éxito. Puede quedar la cuenta bloqueada y un borrado parcial; se conserva perfil y metadatos de operación para volver a confirmar y continuar. No se promete deshacer.
- La operación mantiene el UID Auth original aunque Auth ya se haya eliminado. Reintentar no borra una cuenta nueva que use el mismo email.
- Solo se tolera `auth/user-not-found` después de tener una operación con vínculo verificado. Otros errores de Auth se propagan. Una cuenta ausente antes de iniciar una operación nueva requiere revisión.
- Una operación en curso rechaza la siguiente. Una caída sin liberar la reserva permite reintento tras **10 minutos**; la función tiene tiempo máximo configurado de **9 minutos**. Los errores capturados liberan la reserva inmediatamente. La reserva usa el reloj del servidor.
- Un reintento de una operación completada vuelve a verificar el permiso y responde éxito sin repetir borrados. Los metadatos/tombstones no se exponen al cliente; necesitan política de conservación técnica al integrar P01.

## Condiciones antes de activar

- Desplegar y verificar reglas de P01 que protejan principales, identidad/propiedad de perfiles y datos, y denieguen lectura/escritura de clientes a `staffDeletionJobs`. El prototipo aplica denegación por defecto a colecciones nuevas, pero no está desplegado.
- Aprovisionar los principales confiables desde servidor; no copiarlos automáticamente desde roles alterables del cliente. No se añadieron custom claims ni un script automático de provisión en P04.
- Integrar todos los escritores de P01 —alta/invitación/registro, clínica, agenda, avisos, uploads y perfiles— para rechazar usuarios/Doctores con un job de baja activo o completado. En Asistentes comprobar también el job de su Doctor. Especialmente comprobar el job en el registro de una invitación antes de crear/vincular Auth: de otro modo una alta simultánea puede crear una cuenta después de la comprobación de ausencia. Los escritores actuales **no implementan todavía esta coordinación**.
- Invalidar/recalcular acceso y proyecciones familiares del portal al eliminar pacientes. El login actual del Paciente no usa Firebase Auth; eliminar la cuenta del Doctor no revoca por sí mismo la sesión de sus tutores. Es parte de P01.
- Probar, con emuladores y cuentas sintéticas, operación completa, permisos efectivos, sesión ya abierta y fallos reales entre sistemas. La prueba local actual simula los adaptadores; no reemplaza esta verificación integrada.
- Desplegar backend/frontend de forma coordinada y habilitar el parámetro solo después de esas verificaciones. No hay autorización de despliegue ni cambios remotos realizados en este trabajo.

**Límite de revocación:** revocar refresh tokens no retira automáticamente todo ID token ya emitido ni documentos impresos/cacheados. La denegación efectiva en lecturas/escrituras exige reglas/endpoints que comprueben el principal activo. No se implementó un cierre visual inmediato de todas las ventanas del usuario. Referencia: [Firebase: gestión de sesiones](https://firebase.google.com/docs/auth/admin/manage-sessions).

## Verificación reproducible

Desde `functions/`: `npm run build` y `npm run lint`. Desde raíz: `node --test security/p04/staff-deletion.spec.mjs`, después de compilar Functions. No importar `functions/lib/index.js` en pruebas: contiene la inicialización/verificación SMTP del proyecto.

Pruebas de aplicación: `node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.spec.ts --include=src/app/core/services/staff-deletion.service.spec.ts --include=src/app/core/services/cascade.service.spec.ts --include=src/app/pages/doctors/doctors.spec.ts`.

**Resultados iniciales de P04:** 48 pruebas backend/política/adaptadores y 24 de aplicación aprobadas. Después de P05: **61 backend y 24 de aplicación** aprobadas. Compilación Functions, Angular de desarrollo y lint Functions aprobados; lint conserva tres advertencias preexistentes de `any` en `index.ts`, sin errores. Las pruebas usan datos sintéticos, Admin simulado y servicios de Angular simulados; no se leen ni escriben proyectos reales. No se ejecutó compilación de producción ni prueba integrada de emuladores.

Fuentes:
- `functions/src/staff-deletion.ts`
- `functions/src/staff-deletion-policy.ts`
- `functions/src/index.ts`
- `src/app/core/services/staff-deletion.service.ts`
- `src/app/core/services/cascade.service.ts`
- `src/app/pages/doctors/dialogs/delete-doctor-dialog/`
- `security/p04/staff-deletion.spec.mjs`
- `security/p01/ANALISIS_Y_PROPUESTA.md`

Referencias de SDK: [Admin: gestión de usuarios](https://firebase.google.com/docs/auth/admin/manage-users), [Functions: parámetros de configuración](https://firebase.google.com/docs/functions/config-env).
