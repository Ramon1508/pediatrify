# P01 — Preparación de activación coordinada

**Activación completada tras autorización del usuario (10 de octubre de 2026, hora del consultorio).** Fases A–G publicadas con salida 0: 16 índices READY; mantenimiento temporal; servidor compatible con parámetros cerrados; cinco correspondencias aplicadas y verificadas; reglas finales comparadas; 22 Functions ACTIVE con los cuatro parámetros habilitados; Hosting final disponible. Raíz, Acceso paciente y entrada administrativa sirven el artefacto Angular exacto en ambos dominios comprobados. D09 omite pruebas funcionales externas con cuentas/SMTP. Base objetivo: Firestore Standard Native, `(default)`. No se migraron ni borraron datos de negocio, ni se recrearon cuentas o cambiaron contraseñas del personal.

## Prerrequisitos de operador

**Preparación local de CLI:** Google Cloud CLI 588.0.0 portable con Python, archivo oficial y SHA-256 verificado; sin cambios de PATH global. Launcher: `%TEMP%\lilcare-p01-gcloud-588\google-cloud-sdk\bin\gcloud.cmd`. ADC autorizado en navegador y proyecto de cuota configurado; lecturas Firestore/Auth y autenticación de Firebase CLI comprobadas. Reporte privado regenerado durante mantenimiento: cinco filas idénticas a la revisión previa, aprobadas, aplicadas y verificadas. La invitación pendiente quedó excluida. Revisión específica registrada exclusivamente en `../../PENDIENTES.md`. [Procedimiento oficial de ADC local](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment), [configuración del proyecto de cuota](https://docs.cloud.google.com/docs/authentication/troubleshoot-adc).

1. Confirmar proyecto y bucket en privado; usar `--project` en todos los comandos, sin cambiar un alias global por conveniencia. Los identificadores de ejemplo se sustituyen por los revisados, no por `demo-lilcare-p01`.
2. ADC para las herramientas Admin SDK e identidad CLI autorizada para publicar. Permisos de Firestore, Auth, Hosting/Storage, Functions/Secret Manager y firma de tokens según los servicios. No pegar credenciales ni resultados sensibles en Git/chat/logs compartidos.
3. Node **24** para Functions, dependencias lockfile instaladas en raíz/Functions/`security/p01`. Java 21 únicamente para los emuladores. Builds y pruebas del [avance](AVANCE_INTEGRACION.md) aprobados para el artefacto final.
4. Registrar revisión/artefacto de Hosting y estado previo de reglas/índices/funciones/parámetros, sin exportar datos clínicos. Confirmar ventana con el responsable y finalizar/reintentar las operaciones de invitación/correo/baja en curso antes de detener escritores.
5. Secretos provisionados mediante entrada privada: `PATIENT_CREDENTIAL_ENCRYPTION_KEY`, `PATIENT_PASSWORD_UNIQUENESS_KEY` (32 bytes hexadecimales cada uno), `PATIENT_LOGIN_LIMITER_KEY`; configuración SMTP del servidor accesible. No generar otra clave si ya existe una credencial que utiliza la vigente. Los [secretos declarados deben vincularse a cada función que los usa](https://firebase.google.com/docs/functions/config-env).
6. Revisar los cuatro parámetros de despliegue: `CLINIC_SECURITY_ENABLED`, `STAFF_DELETION_ENABLED`, `STAFF_EMAIL_CHANGE_ENABLED`, `STAFF_INVITATIONS_ENABLED`. Comienzan en false para la ventana; activar conjuntamente al final. Configuración privada por proyecto, sin valores de secretos versionados.

**Revisión concreta final preparada:** manifiesto privado de 91 archivos de cliente, 38 archivos compilados del servidor y siete configuraciones/reglas; comparación exacta de índices, metadatos de servicios y permisos del operador disponibles en `security/p01/review-plans/` (ignorado). Cliente 886/886, Node 269/269, grupos de emulador del [avance](AVANCE_INTEGRACION.md), builds y lint aprobados. Cinco perfiles candidatos conservan cuentas y una invitación queda excluida. Revisar y regenerar las huellas si cambia el artefacto. Estado y decisiones de perfiles exclusivamente en `../../PENDIENTES.md`. Cinco filas aplicadas y verificadas durante la ventana autorizada.

Antes de la fase C, habilitar Secret Manager si corresponde al estado revisado y provisionar las tres claves declaradas usando entrada privada. No pasar valores por argumentos ni imprimirlos. Confirmar permisos de acceso de cada función a sus secretos. Para tokens del **personal**, revisar `iam.serviceAccounts.signBlob` de la cuenta runtime; si necesita concesión, limitar `roles/iam.serviceAccountTokenCreator` a su propia cuenta de servicio, conservando la política/etag existentes. No conceder firma a usuarios del navegador ni provisionar cuentas Auth de Paciente. [Permisos de firma oficiales](https://firebase.google.com/docs/auth/admin/create-custom-tokens).

## Entrega revisable

| Artefacto | Uso |
| --- | --- |
| `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Conjunto final integrado. |
| `firebase.p01.maintenance.json` | Configuración explícita de ventana, distinta de la publicación final. |
| `security/p01/maintenance.firestore.rules` | Niega SDK de negocio durante ventana, incluyendo pestañas antiguas. |
| `security/p01/maintenance.storage.rules` | Conserva lectura pública de logos por enlace; niega uploads/borrados/listado. |
| `security/p01/maintenance-hosting/index.html` | Página temporal de mantenimiento para rutas del sitio. |
| `functions/src/index.ts` y módulos exportados | Servicios verificados y endpoints antiguos retirados. |
| `functions/src/clinic-patient-portal.ts`, `clinic-patient-token.ts` | Portal sin cuentas Firebase Auth de Paciente: sesión opaca en memoria, lecturas/escrituras y streaming solo servidor. Publicar junto con cliente/reglas; no registrar cuentas de pacientes. |
| `dist/pediatrify/browser` | Cliente compatible con sesiones/contratos actuales. |
| `prepare-staff-authority.mjs` | Plan y aplicación revisada de autoridad existente, sin recrear Auth. |

Cambiar Hosting a mantenimiento no detiene pestañas ya abiertas ni Admin SDK. La ventana combina reglas cerradas, todos los parámetros cerrados y espera de finalización de solicitudes previas. No efectuar escrituras manuales de perfiles ni trabajos Admin SDK mientras se revisan planes.

## Secuencia de publicación

Estos comandos documentan la secuencia ejecutada y sirven como referencia para futuras ventanas, desde raíz. `$p01Project` es el proyecto revisado, no contiene credenciales. Revisar cada resultado antes de avanzar; no ejecutar todo como script ciego. Las correspondencias ya aplicadas no se reaplican desde el plan anterior: una futura operación requiere huellas/reporte nuevos.

```powershell
# A. Índices, antes de la ventana; esperar estado listo antes de habilitar consultas.
npx -y firebase-tools@latest deploy --project $p01Project --only firestore:indexes --config firebase.json

# B. Ventana: bloquear SDK y mostrar mantenimiento.
npx -y firebase-tools@latest deploy --project $p01Project --only firestore:rules,storage,hosting --config firebase.p01.maintenance.json

# C. Publicar todo el servidor compatible con los cuatro parámetros en false.
npx -y firebase-tools@latest deploy --project $p01Project --only functions --config firebase.json

# D. Preparar autoridad privada; revisar cada fila, marcar approved=true.
node security/p01/prepare-staff-authority.mjs --project $p01Project --database '(default)' --plan security/p01/review-plans/staff-authority.json
node security/p01/prepare-staff-authority.mjs --project $p01Project --database '(default)' --plan security/p01/review-plans/staff-authority.json --apply --reviewed

# E. Reglas finales, con Hosting aún en mantenimiento.
npx -y firebase-tools@latest deploy --project $p01Project --only firestore:rules,storage --config firebase.json

# F. Tras configurar los cuatro parámetros en true, publicar Functions compatibles.
npx -y firebase-tools@latest deploy --project $p01Project --only functions --config firebase.json

# G. Publicar únicamente el artefacto Angular que pasó la revisión final.
npx -y firebase-tools@latest deploy --project $p01Project --only hosting --config firebase.json
```

El operador debe comprobar que la compilación final conserva los archivos privados de configuración autorizados y apunta al proyecto revisado. La configuración candidata de Storage usa Firestore; revisar la vinculación de permisos entre servicios al publicar. Se permiten solo **dos** lecturas por evaluación de Storage; se usan principal y sesión. [Condiciones cross-service de Storage](https://firebase.google.com/docs/storage/security/rules-conditions).

Los índices pueden tardar en construirse y no se consideran listos por el solo éxito de enviar su definición. Confirmar su estado antes de habilitar cliente. [Gestión de índices](https://firebase.google.com/docs/firestore/query-data/indexing).

Si la herramienta de autoridad encuentra conflictos, no sobrescribirlos ni buscar roles por correo desde navegador. Revisar la fila en privado. Se exige al menos un Admin operacional; invitaciones pendientes quedan excluidas. Si una aplicación queda parcial, preparar un reporte con nombre nuevo, conservar las filas ya aplicadas y revisar las restantes contra el estado actual.

La corrección autorizada de `uid` de un Doctor requiere una fila `normalizeSourceUid:true`, huella de origen vigente y `--normalize-source-id` con el mismo documento tanto al preparar como al aplicar. No cambia documento ni cuenta/contraseña. Solo admite el formato de identificador compatible con el servidor; si el documento también es incompatible, la herramienta bloquea la fila y exige resolver la decisión registrada. No convertir una fila bloqueada en aprobada manualmente para eludir esa comprobación.

## Verificación y evidencia de cierre

**Confirmación posterior del usuario (10 de octubre de 2026):** D09 cerrado; el usuario informa que los correos funcionan correctamente y no solicita continuar el ensayo externo. Acepta también las notificaciones actuales y comunica la confirmación clínica del Doctor para P37/D11. El cierre por confirmación no cambia la evidencia de despliegue ni convierte el ensayo omitido en una prueba ejecutada.

- [x] Resultado de publicación por fase y revisión/artefacto final registrado.
- [x] Reglas finales efectivas comparadas con archivos candidatos; 16 índices READY.
- [x] Veintidós Functions ACTIVE y cuatro parámetros habilitados; Secret Manager/IAM vinculados, sin copiar valores.
- [x] Página final disponible y rutas SPA correctas; seis respuestas HTTP 200 con `index.html` idéntico al artefacto. Mantenimiento retirado.
- [x] Confirmación privada de conservación de cinco UIDs/cuentas del personal; dos Admins operacionales conservados.
- [x] Evidencia del entorno separada de la evidencia de emulador. Ensayo externo con cuentas/SMTP omitido según D09, sin declararlo aprobado.
- [x] `PENDIENTES.md` actualizado con lo activado y lo aún no comprobado. El cierre de D10 incluye servidor, configuración, reglas, índices, cuentas y Hosting.

Evidencia privada ignorada: `review-plans/functions-deployed-enabled.json`, `authority-applied-verification.json`, `rules-effective-verification.json`, `index-state-deployed.json`, `hosting-effective-verification.json` y los logs de cada fase `d10-deploy-*-debug.log`. No contienen valores de claves en los resúmenes de verificación; no deben publicarse reportes privados completos.

Los servicios exportados incluyen `patientPortal` (también streaming), login del Paciente sin Firebase Auth, sesión del personal, acceso/renovación/alta de paciente, operaciones/publicaciones, correo/recuperación y baja/cambio de correo/invitaciones del personal. Solo personal recibe tokens Firebase personalizados. Los tres endpoints antiguos de correo permanecen explícitamente retirados. La lista autoritativa es `functions/src/index.ts`.

## Recuperación de una fase fallida

Mantener página de mantenimiento, reglas cerradas y parámetros false mientras se repara/republica un conjunto compatible. Conservar los secretos vigentes y la autoridad ya revisada. Una publicación parcial no justifica restaurar reglas permisivas ni el frontend antiguo contra los contratos nuevos. Recuperar servicios/índices y luego continuar desde la fase verificada. No borrar datos, cuentas o planes para ocultar una fase fallida.

Hosting admite versiones/canales, pero cualquier recuperación debe seleccionar un artefacto compatible con las reglas/servidor actuales; solo recuperar Hosting no recupera las demás piezas. [Publicación y canales de Hosting](https://firebase.google.com/docs/hosting/test-preview-deploy).

## Mantenimiento posterior autorizado por D07/D08

Los siguientes preparan reportes; no se ejecutaron durante esta implementación. Usar nombres de plan nuevos cuando ya exista un reporte y revisar filas antes de aplicar:

```powershell
node security/p01/prepare-maintenance.mjs --project $p01Project --database '(default)' --mode logos --bucket $p01Bucket --plan security/p01/review-plans/logos.json
node security/p01/prepare-maintenance.mjs --project $p01Project --database '(default)' --mode retention --plan security/p01/review-plans/retention.json
# Solo las filas approved=true: agregar --apply --reviewed al mismo comando.
# Logos exige además --writers-stopped durante ventana real sin escritores concurrentes.
```

Retención: treinta días desde expiración/finalización, no creación de un registro aún activo. Compacta barreras de baja/envío/invitación en lugar de borrarlas; conserva clínica/bitácora/acceso vigente. Sesiones `serverOnly` del Paciente se retiran solo del almacenamiento privado, sin consultar/eliminar cuentas Auth. La compatibilidad con sesiones Auth históricas está separada; jamás se retiran cuentas de personal. No se añadió cron ni TTL indiscriminado.

## Rotación de claves fuera de servicio

1. Cerrar escritores como en B/C; esperar solicitudes previas. Resolver/revisar intentos inciertos antes de la ventana. Mantener cerrados también los operadores y pestañas antiguas.
2. Mantener disponible la versión anterior de las claves y preparar nuevas versiones de manera privada. Cargar en el proceso únicamente los nombres `P01_PREVIOUS_ENCRYPTION_KEY`, `P01_NEXT_ENCRYPTION_KEY`, `P01_PREVIOUS_UNIQUENESS_KEY`, `P01_NEXT_UNIQUENESS_KEY`; no usar valores en argumentos, archivo versionado ni salida. Para cambiar solo AES, ambas variables de unicidad utilizan la misma clave vigente.
3. Preparar `prepare-credential-key-rotation.mjs` con proyecto/base/plan privado y `--writers-stopped`; revisar **todas** las filas. Aplicar el mismo comando agregando `--apply --reviewed`.
4. La herramienta cambia cifrado y reserva por transacción, conserva contraseña/verificador/época/revisión/contactos y verifica el conjunto. Si falla, mantener ventana y reanudar el **mismo plan con las mismas claves**; no generar otro plan sobre un conjunto parcialmente rotado.
5. Solo tras `completed:true`, actualizar las versiones activas de `PATIENT_CREDENTIAL_ENCRYPTION_KEY` y, si cambió, `PATIENT_PASSWORD_UNIQUENESS_KEY`, y republicar las funciones que las declaran. Comprobar estado antes de reabrir reglas/cliente y parámetros. Los recibos previos permanecen: pedidos antiguos pueden requerir releer estado, sin recrear alta/renovación.
6. Retirar variables de proceso y mantener versiones anteriores protegidas hasta completar la revisión de recuperación. No se publica ninguna clave mediante la herramienta.

Esta operación cambia claves de almacenamiento, **no la contraseña del paciente**. No se realiza como parte del alta inicial ni implica migración de datos históricos.
