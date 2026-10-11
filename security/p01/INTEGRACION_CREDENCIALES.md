# P01 — Acceso, credenciales y mantenimiento

Actualizado: **10 de octubre de 2026**. **Integrado/probado localmente; no activado ni desplegado.** D01–D11 de `../../PENDIENTES.md` prevalecen. No contiene credenciales ni datos reales.

## Operaciones conectadas

| Operación | Actor | Resultado |
| --- | --- | --- |
| Acceso del personal | Cuenta Firebase/autoridad vinculada | Sesión validada de dispositivo; mismo UID/contraseña. Perfil incompleto dirige a completar registro. |
| Acceso del paciente | Contacto principal/secundario y código vigente | Sesión opaca solo en memoria y familia del mismo Doctor; sin cuenta/token Firebase Authentication. |
| Alta | Doctor o su Asistente con Doctor válido | Un paciente/credencial/proyecciones; confirma duplicados antes del alta y no devuelve contraseña. |
| Correo | Doctor propietario o Asistente de su alta original | Ambos correos guardados deduplicados; resultado por destino, reintento sin duplicar paciente. |
| Consultar/copiar/renovar | Solo Doctor propietario | Consulta actual; renovación generada y transaccional, revoca revisión anterior. Sin edición manual. |
| Cambiar contactos | Doctor propietario | Misma contraseña; alias/revisión cambiados junto con paciente. |
| Baja | Doctor propietario o cascada de Doctor autorizada | Bloqueo inmediato, limpieza resumible, reserva retirada, bitácora/barrera conservadas. |
| Inactividad/cierre | Cada dispositivo de cuatro roles | Máximo una hora inactiva; contraseña no expira. |

Asistente no recibe contraseña por alta/correo/consulta. Reenvío requiere su recibo original, misma época y revisión inicial; no reenvía la credencial ya renovada por Doctor. Renovación confirmada con correo fallido conserva resultado y reintenta correo, sin regenerar.

## Contratos/reintentos

- `getClinicPatientAccess`: únicamente `patientId`.
- `renewClinicPatientAccess`: `patientId`, `operationId`, `expectedVersion`, `expectedEpoch`; rechaza contraseña/autoridad aportadas.
- Ambas responden `password`, `credentialVersion`, `credentialEpoch`, comprobados por adaptador y excluidos de caché de sesión.
- `createClinicPatient`: `operationId`, `patient` básico, `confirmedDuplicates` si procede. Propietario/ID/contraseña del servidor; mismo intento devuelve un único paciente.
- `sendClinicEmail`: clase de envío, ID de operación y paciente/invitación; para Asistente, alta original. Sin contraseña/destinatario arbitrarios.
- `saveClinicData`: operación, ID de operación/entidad y campos permitidos; identidad firmada deriva alcance. Recibo evita repetir bitácora/avisos.

Reintento: **mismo ID y mismos datos**; acción posterior: nuevo ID. Conflicto de revisión exige releer antes de otra renovación. Token verificado con revocación, principal/perfil/bajas y arrendamiento fresco. Caché local no acredita identidad. Gateway descarta respuestas de otra sesión y no hereda intentos al reemplazarla.

## Datos privados y mínimos

| Ruta | Uso |
| --- | --- |
| `patientCredentials/{patientId}` | Scrypt, AES-256-GCM, contactos, época/revisión, huella privada. Solo servidor. |
| `patientPasswordReservations/{fingerprint}` | HMAC global de contraseña **activa**; reserva transaccional, liberada al renovar/baja. Código retirado puede reutilizarse. |
| `patientCredentialOperations/{digest}` | Recibo mínimo de renovación, sin contraseña/ciphertext. |
| `patientCreationOperations/{digest}` | Alta idempotente y autorización de su reenvío original. |
| `clinicOperations/{digest}` | Recibo de escritura de negocio. |
| `securityPrincipals/{authUid}` | Autoridad protegida; personal conserva UID Auth. Para Paciente el campo heredado authUid identifica una sesión interna aleatoria serverOnly, no una cuenta Auth; SDK denegado. |
| `clinicSessions/{sessionId}` | Personal: claim firmado de dispositivo. Paciente: hash SHA-256 del bearer aleatorio de 256 bits, actividad/caducidad; no se persiste su bearer original. |
| `patientSessionStatus/{patientId}` | Estado/época/revisión mínimos para cierre visual; sin contactos ni credenciales. |
| `familyAccess/{authUid}/patients/{patientId}` | Membresía de servidor; lecturas contrastan contactos/Doctor/bajas actuales. |
| `patientDirectory`, `patientPortal`, `appointmentSlots`, `patientDocuments` | Proyecciones mínimas; publicaciones por broker, no expediente completo. |
| `patientDeletionJobs`, `staffDeletionJobs` | Barreras de baja; compactación de detalles finalizados, no borrado del marcador. |
| `auditLog` | Acción/actor/entidad/fecha de servidor; sin credenciales. Se conserva. |

AES autentica Doctor/paciente/época/revisión. Época distingue recreaciones del mismo ID; revisión invalida accesos anteriores sin recorrer dispositivos. Contraseña de otro hermano conserva acceso legítimo sujeto a su revisión/pertenencia, no se revoca globalmente a toda la familia.

## Herramientas revisables

Requieren ADC autorizado, proyecto explícito/base `(default)`; no navegador/endpoints. Planes privados bajo `security/p01/review-plans/`, ignorados por Git, sin valores de contraseña/clave. No ejecutadas contra Firebase en esta implementación.

| Herramienta | Preparación / aplicación |
| --- | --- |
| `prepare-staff-authority.mjs` | Contrasta perfiles/Auth/autoridad, excluye pendientes/conflictos. Filas aprobadas + `--apply --reviewed`; exige Admin operacional, relee huellas, conserva cuentas/contraseñas. No alta automática de cuentas/roles. |
| `prepare-maintenance.mjs --mode logos` | Solo `logos/`, comprueba todas las referencias conocidas. Aplicación revisada exige `--writers-stopped`, nueva lectura de referencias y condición de generación. Limpieza manual, no tarea a siete días. |
| `prepare-maintenance.mjs --mode retention` | Sesiones/registros técnicos finalizados o vencidos hace más de 30 días. Preserva clínica/bitácora/credenciales/reservas/barreras. Sesiones serverOnly no llaman Auth; la compatibilidad de limpieza Auth histórica permanece separada y nunca afecta personal. |
| `prepare-credential-key-rotation.mjs` | Fuera de servicio; claves solo en memoria, plan sin valores sensibles. Todas las filas aprobadas; transacción por credencial conserva contraseña/verificador/revisión y cambia cifrado/reserva. Reanuda el mismo plan con las mismas claves y verifica el conjunto antes de publicar nuevas versiones. |

Fallo de autoridad/retención/limpieza: preparar otro reporte privado y revisar estado fresco, no aprobar huellas obsoletas. Rotación interrumpida: reanudar **el mismo plan** con las mismas claves y escritores detenidos. No hay TTL de credenciales ni borrado automático de logos. Treinta días es mantenimiento técnico elegido, no caducidad de contraseña ni afirmación legal.

## Configuración: solo nombres

### Portal del Paciente: decisión vigente

`loginClinicPatient` valida correo/código sin invocar Firebase Authentication. Devuelve una sesión opaca que solo vive en el servicio: no cookies, localStorage ni sessionStorage. Recargar/cerrar pestaña exige entrar de nuevo; el código sigue reutilizable hasta renovación. El cierre y la hora de inactividad se verifican también en servidor.

`patientPortal` acepta únicamente sesión y operaciones allowlisted: sesión/familia/resumen, perfil público del Doctor, citas familiares, ocupación anónima, publicaciones vigentes y bandeja propia. Escrituras limitadas a operaciones de cita permitidas y marcar avisos propios como leídos. Ningún bearer habilita operaciones de personal. Streaming usa listeners Firestore en servidor, revalida cada respuesta y cada diez segundos; escuchar/recibir datos no extiende actividad. Cada conexión se renueva tras dos minutos y se libera al desconectar. Sin secretos/valores de credenciales en logs o cache del navegador.

Fuentes adicionales: `functions/src/clinic-patient-token.ts`, `clinic-patient-portal.ts`; pruebas `security/p01/patient-portal.emulator.spec.mjs`.

- Parámetros inicialmente cerrados: `CLINIC_SECURITY_ENABLED`, `STAFF_DELETION_ENABLED`, `STAFF_EMAIL_CHANGE_ENABLED`, `STAFF_INVITATIONS_ENABLED`.
- Secretos: `PATIENT_CREDENTIAL_ENCRYPTION_KEY`, `PATIENT_PASSWORD_UNIQUENESS_KEY` (32 bytes hexadecimales), `PATIENT_LOGIN_LIMITER_KEY`.
- SMTP: configuración existente del servidor; no copiarla a UI/planes/documentación/logs.
- Variables de proceso para rotación: `P01_PREVIOUS_ENCRYPTION_KEY`, `P01_NEXT_ENCRYPTION_KEY`, `P01_PREVIOUS_UNIQUENESS_KEY`, `P01_NEXT_UNIQUENESS_KEY`. Herramienta no lee/publica Secret Manager.

Instrucciones concretas: [ACTIVACION_COORDINADA.md](ACTIVACION_COORDINADA.md). Evidencia: [AVANCE_INTEGRACION.md](AVANCE_INTEGRACION.md).

Fuentes: `functions/src/clinic-auth.ts`, `clinic-leases.ts`, `clinic-sessions.ts`, `clinic-patients.ts`, `patient-credentials.ts`, `clinic-operations.ts`, `clinic-mail.ts`, `clinic-patient-deletion.ts`; `src/app/core/services/auth.service.ts`, `clinic-gateway.service.ts`, `patient-access.service.ts`, `email.service.ts`; reglas raíz y herramientas/pruebas en `security/p01/`.
