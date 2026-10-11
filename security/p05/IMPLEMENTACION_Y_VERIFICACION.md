# P05 — Baja conjunta del Doctor, Asistentes y recursos propios

Decisión del usuario del 8 de octubre de 2026: **opción 1**, eliminar también los Asistentes asociados al Doctor y limpiar sus recursos propios. Implementación local sobre la callable de P04. **Sin despliegue, sin cuentas/datos reales y sin migraciones históricas.**

## Estado y autorización

**IMPLEMENTADO LOCALMENTE / ACTIVACIÓN PENDIENTE DE P01**, igual que P04. `STAFF_DELETION_ENABLED` continúa deshabilitado por defecto. No se cambió configuración de Firebase ni archivos de entorno.

El Administrador autorizado para eliminar un Doctor puede ejecutar la cascada de sus Asistentes. Esto no concede al Administrador una operación general de baja individual de Asistentes. La baja individual sigue siendo exclusiva de su Doctor. No se amplió la autorización para eliminar Administradores de P45.

Los Asistentes se identifican por **rol Asistente y `createdBy` igual al ID del Doctor**, usando IDs de documentos; no por email, nombre ni el campo `uid` almacenado. Cada acceso creado exige su vínculo con el principal confiable de P01. Si un Asistente tiene identidad inválida/sin verificar, la preparación falla antes de bloquear al Doctor o borrar expedientes; no se omite esa cuenta silenciosamente.

## Orden de la cascada

1. Reserva de baja del Doctor en `staffDeletionJobs/{userId}`.
2. Consulta limitada al Doctor para identificar Asistentes, más recuperación de jobs secundarios previos por `parentUserId`. Verificación y reserva individual de cada Asistente, incluidas invitaciones pendientes sin cuenta Auth.
3. Deshabilitación y revocación de los accesos del Doctor y de todos los Asistentes reservados.
4. Desactivación de todos sus principales antes de empezar el borrado de expedientes/recursos.
5. Limpieza de recursos, Auth y perfil de cada Asistente; su job queda completado.
6. Borrado de pacientes, registros clínicos, citas y avisos asociados; limpieza de bandeja y logos del Doctor.
7. Baja Auth del Doctor y transacción final que elimina su perfil y completa su job.

Se verifica el vínculo de cada cuenta antes de utilizar Admin SDK. Una baja independiente ya en curso de un Asistente impide comenzar la cascada simultánea; una baja activa del Doctor impide iniciar una baja independiente de sus Asistentes. Una cascada reintentada recupera jobs secundarios y no repite el borrado de Asistentes ya completados.

Un fallo puede dejar accesos bloqueados y recursos parcialmente eliminados. No hay reversión automática. Se conservan identidad original, perfiles pendientes y jobs para reintentar; la UI no anuncia éxito parcial. Las reservas expiran en diez minutos si la ejecución termina abruptamente; las capturadas se intentan liberar, sin ocultar el error original. No se agrega un proceso automático en background: el reintento se inicia al volver a confirmar.

## Qué se limpia

| Recurso actual | Regla de limpieza |
|---|---|
| Asistentes del Doctor | Perfil y Auth vinculados, con revocación; invitaciones pendientes propias sin Auth se retiran. |
| Pacientes / registros clínicos | Se mantiene el alcance de P04: pacientes cuyo `doctorId` es el Doctor y registros vinculados por `patientId`. La baja individual de Asistente conserva esos expedientes. |
| Citas | Se eliminan las citas del Doctor y las vinculadas a sus pacientes, incluidas deshabilitadas. Una baja individual de Asistente conserva la agenda del Doctor. |
| Avisos de citas eliminadas | Se eliminan **todas las copias por destinatario** cuyo `appointmentId` coincide, antes de borrar la cita. Mantener ese orden permite localizar avisos al reintentar. |
| Bandejas de cuentas eliminadas | Se eliminan documentos actuales de `notifications` cuyo `recipientId` coincide con Doctor, Asistente o paciente que se elimina. |
| Avisos de otros consultorios | Se conservan cuando ni el destinatario ni la cita se eliminan. No se usa `originatorId` como criterio general: borrar un Asistente no borra por ello avisos ajenos sobre una cita vigente del Doctor. |
| Logos | Solo prefijo canónico `logos/{ID del perfil}/` del Doctor/Asistente, en el bucket predeterminado. Incluye archivos reemplazados y subidos antes de cancelar un formulario, no solo el logo activo. |
| Horarios / impresión | Son campos de `users/{id}` (`timeSegmentsByDay`, duración, `allowPatientScheduling`, `printSettings`, etc.); desaparecen al eliminar el perfil completo. No hay colección independiente que limpiar en el código actual. |

## Qué se conserva y límites

- Cuentas, expedientes, citas y logos de otros Doctores y Asistentes.
- Marca estática Lilcare y objetos fuera del prefijo privado del perfil. No se sigue `logoPath`, `photoURL`, una URL de descarga, `gs://`, un enlace externo ni un logo antiguo sin dueño identificable para decidir qué borrar. No se enumeran otros buckets ni se borra un prefijo global.
- Bitácora (`auditLog`), contadores de correo (`emailCounter`) y metadatos de revocación/reintento de servidor. Su conservación impide reutilizar identidades de una baja y permite verificar su estado; no son recursos de presentación del Doctor.
- No se prepara limpieza del modelo viejo de avisos con arrays de destinatarios ni de archivos históricos fuera del prefijo. Los datos antiguos están fuera de alcance por decisión del usuario.
- No se modifica el acceso actual de tutores como si fueran cuentas del Doctor. Invalidación/recalculo de proyecciones y sesiones familiares sigue dentro de P01; su portal actual no usa Firebase Auth. No se garantiza cierre visual inmediato ni retirada de contenido ya descargado/impreso.
- Storage se lista en páginas de hasta 100 objetos, incluyendo versiones listables, y los borrados se esperan todos antes de liberar la reserva aunque alguno falle. Solo se ignoran objetos ya inexistentes. Permisos fallidos, retenciones u otros errores detienen el éxito y dejan posibilidad de reintento.
- Las políticas reales de retención/soft delete/backups del bucket no se pueden determinar desde el repositorio. La operación elimina los objetos/versiones accesibles al SDK; no promete purga física de todas las copias retenidas por el proveedor. Referencias: [listar objetos](https://cloud.google.com/storage/docs/listing-objects), [SDK Storage: Bucket](https://googleapis.dev/nodejs/storage/latest/Bucket.html), [SDK Storage: File](https://googleapis.dev/nodejs/storage/latest/File.html).

## Confirmación visible

- Doctor: advierte sobre Asistentes, cuentas de acceso, pacientes, historiales, citas, logos y avisos asociados, y sobre el carácter irreversible.
- Asistente: advierte sobre su acceso/perfil/recursos y explica la conservación de pacientes, historiales y agenda del Doctor.
- Texto derivado de signals/computed, sin getters ni funciones de presentación nuevas en HTML. Se conserva el bloqueo de botones/cierre de P04.

Esta actualización corrige también el texto contradictorio de **P11** como consecuencia necesaria de explicar fielmente el alcance elegido; no cambia una política adicional de eliminación.

## Activación y coordinación pendiente

Aplican todas las condiciones de [P04](../p04/IMPLEMENTACION_Y_ACTIVACION.md). P01 debe proteger los principales y jobs, aprovisionar vínculos y trasladar escrituras al servidor. Además:

- Alta/registro/reasignación de Asistentes debe comprobar el job del **Doctor propietario** y el del Asistente; no basta consultar uno solo.
- Escrituras de agenda, clínica, avisos y uploads de logos deben rechazar usuarios/Doctores con bajas activas/completadas. Los escritores actuales todavía no tienen esa coordinación. De otro modo pueden recrear recursos durante/después de la limpieza.
- Preparar Storage Rules y los permisos del servicio para listar/borrar exclusivamente los recursos previstos; verificar que el bucket predeterminado esté disponible. No se han cambiado reglas ni IAM en P05.
- Invalidar acceso y proyecciones familiares del portal al borrar pacientes, conservando asociaciones a otros consultorios que sigan vigentes.
- Probar conjunto completo con emuladores/cuentas sintéticas antes de habilitar y desplegar de forma coordinada. La activación no se autoriza ni se realiza con este cambio local.

## Pruebas

Después de compilar Functions (`npm run build` desde `functions/`): `node --test security/p04/staff-deletion.spec.mjs` desde raíz. El archivo amplía P04 con las regresiones de P05; importa módulos aislados, nunca el inicializador SMTP `index.js`.

**61 pruebas backend aprobadas**, incluidas 12 nuevas de cascada de accesos, identidad inválida, fallos/reintentos de Auth/Storage, reservas simultáneas, bandejas/copias familiares, logos propios frente a ajenos y conservación de otros recursos. Se añadió también el caso de fallo en preparación de relacionados. Adaptadores simulados: no pruebas de reglas desplegadas ni cuentas reales.

Pruebas de aplicación: los mismos cuatro archivos de P04, **24 pruebas aprobadas**, con comprobaciones del nuevo texto por rol. Compilación Functions y lint sin errores; se conservan tres advertencias preexistentes de tipos en `index.ts`. Compilación Angular de desarrollo comprobada aparte. No se ejecuta compilación de producción ni se captura pantalla.

Fuentes revisadas/modificadas:
- `functions/src/staff-deletion.ts`
- `functions/src/staff-deletion-policy.ts`
- `security/p04/staff-deletion.spec.mjs`
- `src/app/pages/doctors/dialogs/delete-doctor-dialog/delete-doctor-dialog.ts`, `.html`, `.spec.ts`
- `src/app/core/models/user.ts`
- `src/app/core/models/notification.ts`
- `src/app/core/repositories/notification.repository.ts`
- `src/app/core/repositories/print-settings.repository.ts`
- `src/app/pages/calendar/dialogs/settings-dialog/settings-dialog.ts`
- `src/app/shared/components/file-upload/file-upload.ts`
- `src/app/pages/impresion/impresion.ts`
- `src/app/pages/setup-profile/setup-profile.html`
