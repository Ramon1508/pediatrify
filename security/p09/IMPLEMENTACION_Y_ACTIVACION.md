# P08 revisado / P09 / P10 — edición del personal y correo

Implementación local verificada el 9 de octubre de 2026. No se desplegó ni se habilitó el servicio; no se consultaron cuentas o datos de negocio reales.

## Decisión de producto

| Actor | Destino | Campos |
|---|---|---|
| Administrador | Propio | Solo correo; nombre de lectura |
| Asistente | Propio | Nombre y correo |
| Administrador | Doctor | Nombre y correo |
| Doctor | Asistente propio | Nombre y correo |
| Doctor | Propio | Perfil profesional existente; correo propio fijo |

Gestionar Administradores ajenos (P45) sigue separado. Sin nuevas contraseñas, cuentas duplicadas, migración de registros antiguos o reasignación de consultorio.

## Flujo y confirmación

- Un único formulario por editor; estado visible mediante signals/computed y validación reactive forms. Guardar bloqueado por inválido/intacto/sin cambio permitido/carga. Editor de terceros: nombre hasta 200 caracteres; Asistente propio hasta 300. Correo requerido/válido/hasta 254; normalización de servidor/cliente.
- Nombre solo conserva escritura de perfil existente. Para correo, cliente envía únicamente ID de negocio, email esperado/nuevo, operationId y nombre cuando está permitido. No envía rol, Auth UID o contraseña.
- Callable verificado con token revocado/disabled rechazado, autoridad protegida, perfil actualizado y vinculación Auth. Admin→Doctor y Doctor→Asistente asociado; edición propia según tabla. Asistente exige Doctor asociado disponible, con identidad protegida válida.
- Cuenta activa: actualiza correo del UID Auth vinculado y marca correo no verificado; conserva contraseña, claims y referencias de negocio. Confirma Auth, luego actualiza perfil/journal de forma transaccional. No usa correo como identidad de reemplazo ni crea otra cuenta.
- Invitación pendiente sin Auth: cambia perfil sin crear cuenta. Si hay Auth asociado al correo anterior pero sin vínculo protegido, se rechaza para revisión. Tras confirmar, UI pide reenviar invitación al correo nuevo.
- Editor de terceros conserva sesión del operador. Correo propio confirmado cierra sesión y vuelve al login con aviso de usar correo nuevo y contraseña actual. Error al cerrar sesión se comunica como tal: no se presenta el correo ya actualizado como cambio fallido.
- Inicio/restauración de sesión priorizan Auth UID; login no sobrescribe correo canónico de perfil. Esto permite volver a entrar con correo Auth nuevo y reintentar si falló sincronización de perfil.

## Metadata privada / concurrencia

| Documento | Propósito |
|---|---|
| securityPrincipals/{AuthUid} | Autoridad del servidor; UID, rol, propietario y estado vigentes |
| staffEmailChangeJobs/{businessId} | Destino verificado, correos esperado/nuevo, nombre permitido, operationId, lease de 10 minutos, fase completada y timestamps |
| staffEmailReservations/{SHA256(emailNormalizado)} | Exclusión temporal de correo por cuenta/operación; el hash no anonimiza por sí mismo un correo predecible |
| staffDeletionJobs/{businessId} | Bloquea cambio cuando cuenta/Doctor está en baja; baja rechaza cambio de correo inconcluso |

Los campos quedan privados de cliente/logs. Job incompleto conserva cuerpo e identidad originales y libera lease ante fallo. Reintento del mismo contenido puede recuperar operationId anterior al abrir otro editor/login. Cuerpo/identidad distintos, correo esperado desactualizado, otra reserva o lease activo se rechazan. Confirmación completa elimina reserva; conserva job concluido para idempotencia.

**Límite:** Auth y Firestore no comparten transacción. No se promete rollback automático, expulsión instantánea de todas las sesiones del titular, ni invulnerabilidad frente a escritores externos que ignoren reservas. Fallo parcial puede dejar Auth actualizado y perfil antiguo hasta reintento. Auth invalida refresh tokens al cambiar correo, por lo que recuperación propia puede requerir iniciar sesión con nuevo correo/contraseña actual. Identidad modificada/desactivada o payload diferente durante recuperación exige revisión autorizada; no se reasigna ni se fuerza éxito.

## Activación pendiente

Gate **STAFF_EMAIL_CHANGE_ENABLED** false por defecto y comprobado antes de inicializar servicios/leer datos en callable. Está conectado desde UI pero permanece deshabilitado; no existe fallback local para cambiar correo.

Antes de habilitar, completar P01:

1. Autoridad confiable creada solo desde servidor; perfil/UID/roles/asociaciones protegidos.
2. Denegar acceso de cliente a jobs/reservas/principals y prohibir escritura directa de correo/identidad.
3. Coordinar registro/invitación, cambios de nombre/perfil, borrados y todos los escritores con reservas/jobs de cuenta y Doctor. Incorporar unicidad normalizada; no reutilizar un correo reservado durante una recuperación.
4. Adaptar escrituras restantes/consultas/proyecciones del cliente a los permisos; asegurar que datos/avisos usan IDs canónicos y que correo no otorga pertenencia.
5. Probar con emuladores/cuentas sintéticas los permisos, misma contraseña/nuevo correo, sesión propia/operador, nueva invitación y fallo parcial/reintento.
6. Desplegar coordinadamente cliente/backend/reglas; habilitar solo tras esa verificación. No se requiere migración histórica según alcance elegido.

No desplegar solo esta callable habilitada sobre reglas abiertas. No modificar las reglas candidatas como si ya fueran integración terminada.

## Verificación local

- 68 pruebas específicas: Perfil, Header, editor de terceros y servicio de correo.
- Prueba de login y restauración por UID ante correo Auth/perfil distinto.
- Suite Angular completo: 562 pruebas aprobadas en 53 archivos.
- 149 pruebas de servidor y regresión P01/P04: permisos, identidad/token, duplicados, conservación UID/password/datos, invitación pendiente, concurrente lease, fallo parcial, reintento con ID nuevo, idempotencia y coordinación con baja.
- Build Functions y Angular development correctos. Lint Functions sin errores; tres advertencias previas de any en index.ts.
- Son adaptadores simulados; no prueban reglas desplegadas, Admin IAM, latencia/reintentos reales del SDK, proveedor de correo o revocación multiventana.

Comandos locales:

    npm --prefix functions run build
    npm --prefix functions run lint
    node --test security/p09/staff-email-change.spec.mjs security/p04/staff-deletion.spec.mjs security/p01/policy.spec.mjs security/p01/patient-login.spec.mjs
    npx ng test --watch=false
    npx ng build --configuration development

## Fuentes

- functions/src/staff-email-change.ts; staff-deletion.ts; index.ts (export)
- src/app/core/services/staff-email-change.service.ts; auth.service.ts
- src/app/pages/doctors/dialogs/edit-doctor-dialog/
- src/app/shared/components/profile-dialog/
- security/p01/policy.mjs; policy.spec.mjs
- security/p09/staff-email-change.spec.mjs

Firebase oficial: [actualizar usuarios](https://firebase.google.com/docs/auth/admin/manage-users#update_a_user), [sesiones y refresh tokens](https://firebase.google.com/docs/auth/admin/manage-sessions).
