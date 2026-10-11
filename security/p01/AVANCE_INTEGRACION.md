# P01 — Avance de integración

Actualizado: **10 de octubre de 2026**. **Integración implementada, publicada y activada mediante D10 autorizado.** Se verificaron 22 Functions ACTIVE, cuatro parámetros habilitados, secretos vinculados, reglas efectivas idénticas a las revisadas, 16 índices READY, cinco cuentas existentes conservadas y seis rutas públicas con el artefacto Angular exacto. Este registro sustituye las listas anteriores; resultados históricos y observaciones en `PENDIENTES.md`. No se migró ni borró información clínica, no se recrearon cuentas ni se cambiaron contraseñas del personal. El ensayo externo con cuentas/SMTP continúa omitido por D09.

## Implementación actual

**Cierre posterior de seguimientos:** el usuario confirmó correos, aceptó las notificaciones actuales y comunicó que el Doctor confirma las curvas de crecimiento y el esquema de vacunación. D09, notificaciones y P37/D11 cerrados el 10 de octubre de 2026; sin nuevos ensayos externos/clínicos ni cambios de código. Estado vigente en `../../PENDIENTES.md`.

| Área | Comportamiento implementado | Fuentes principales |
| --- | --- | --- |
| Personal | Contraseña Firebase → apertura de sesión protegida → token personalizado. Conserva UID/cuenta/contraseña; no asigna rol por correo desde navegador. | `clinic-sessions.ts`, `auth.service.ts` |
| Paciente | Correo/código reutilizable comprobados en servidor; sesión opaca únicamente en memoria, sin Firebase Auth ni persistencia del navegador. Datos/listeners/escrituras a través de servidor. | `clinic-auth.ts`, `clinic-patient-token.ts`, `clinic-patient-portal.ts` |
| Sesión de cuatro roles | Una hora máxima de inactividad y arrendamiento de servidor. Personal conserva plazo al recargar; Paciente debe entrar de nuevo al recargar/cerrar pestaña. Paciente sale a Acceso paciente; personal a Login. El código no expira por cerrar sesión. | `clinic-leases.ts`, `clinic-sessions.ts`, `clinic-patient-portal.ts`, `auth.service.ts` |
| Credenciales | Generación criptográfica de seis caracteres, reserva global activa, scrypt y copia cifrada AES-256-GCM. Solo Doctor propietario consulta/copia/renueva. | `patient-credentials.ts`, `patient-access.service.ts` |
| Altas | Doctor/Asistente de Doctor válido; propietario derivado; confirmaciones separadas de correo/nombre duplicados, reintento sin duplicar. Nunca devuelve contraseña al creador. | `clinic-patients.ts`, `new-patient-dialog.ts` |
| Escritores | Pacientes/consultas/citas/perfil/horarios mediante operaciones verificadas y transacciones; bajas resumibles. Contactos cambian alias/revisión conservando contraseña. Sin escritores alternativos del navegador. | `clinic-operations.ts`, `clinic-patient-deletion.ts`, repositorios Angular |
| Lecturas | Doctor: expediente propio; Asistente: directorio básico/agenda; Paciente: familia mínima/citas/ocupación anónima; Admin: personal/bitácora. Queries/listeners acotados. | `firestore.rules`, repositorios, `clinic-gateway.service.ts` |
| Publicaciones | Todos los documentos publicados y vigentes mediante servidor; pertenencia/fuente/vigencia inclusiva de México/HTML comprobados. Sin diagnóstico/notas privadas. Orden por creación original. | `clinic-operations.ts`, `clinic-data.ts`, `patient-history-view.ts` |
| Calendario | Canceladas liberan horario; propia cita excluida al editar, otra vigente cuenta. Conserva hora original fuera de disponibilidad; nueva hora requiere disponibilidad. Semana cerrada admitida. Sin reserva atómica de citas (P22). | `clinic-operations.ts`, `clinic-data.ts`, `calendar.ts` |
| Asistente | Modifica días/segmentos/duración; no ve ni cambia permitir reservas. Asistente de Admin: identidad/perfil, sin agenda hasta asociarse a Doctor válido. | `settings-dialog.ts`, `clinic-operations.ts`, `staff-invitations.ts` |
| Correo | Destinos/contraseña del servidor; ambos contactos deduplicados; resultado por destino y reintento pendiente. Asistente solo su alta original, sin credencial devuelta; Doctor no regenera al reintentar correo fallido. | `clinic-mail.ts`, `email.service.ts`, `new-patient-dialog.ts`, `patients.ts` |
| Auditoría/avisos | Generados en servidor con la operación; actor leído, demás sin leer, familia del mismo Doctor. SDK solo cambia read=true de su propia notificación. | `clinic-operations.ts`, `notification.repository.ts`, `firestore.rules` |
| Personal/Admins | P04/P09/P13/P45 verifican autoridad y sesión en transacciones. Solo Admin crea Doctor/Admin; Doctor o Admin crean Asistente en backend. Baja propia/último Admin bloqueadas; baja Admin conserva Doctores/bitácora. | `staff-deletion.ts`, `staff-email-change.ts`, `staff-invitations.ts` |
| Storage | Logo público por enlace; listar denegado. Doctor propietario con sesión vigente sube/elimina PNG/JPEG/SVG no vacío hasta 1 MiB; dos lecturas de autoridad/sesión. | `storage.rules`, `file-upload.ts` |
| Mantenimiento | Herramientas ADC: autoridad preservando cuentas, limpieza manual de logos, retención técnica 30 días conservando barreras, rotación fuera de servicio de claves sin renovar contraseña. | `prepare-staff-authority.mjs`, `prepare-maintenance.mjs`, `prepare-credential-key-rotation.mjs` |

Los módulos de servidor están en `functions/src/`; adaptadores en `src/app/core/services/`. Recuperación del personal: respuesta genérica conocido/desconocido; enlace Firebase únicamente para cuenta vinculada vigente. Endpoints antiguos de correo arbitrario quedan retirados explícitamente, sin fallback.

## Evidencia local actual

| Grupo | Resultado más reciente | Alcance |
| --- | --- | --- |
| Angular completo | **886/886; 73 archivos** | Acceso en memoria/sin Firebase Auth, ausencia de persistencia, revocación/respuesta tardía y dos regresiones de IDs del personal. |
| Node | **269/269** | P01/P04/P09/P13/P45, mantenimiento/claves; incluye cinco regresiones posteriores de revisión/IDs del personal. |
| Política de operador, revisión posterior D10 | **9/9** | Incluye dos regresiones nuevas de códigos sanitizados y normalización explícita/formato de IDs; no implica repetición del conjunto Node ni aplicación remota. |
| Portal/reglas/credenciales/operaciones/login actuales | **9/9 + 19/19 + 22/22 + 23/23 + 11/11** | Grupos separados; operaciones repetidas tras corregir la firma de llamada del nuevo fixture. Las nuevas regresiones comprueban permisos con IDs conservados. Datos sintéticos. |
| Storage/bajas Admin/rotación | **5/5 + 3/3 + 3/3** | Repetidos en el conjunto posterior; Storage incluye propietario de ID conservado y UID Auth distinto. |
| Ventana de mantenimiento | **2/2** | Reglas cerradas niegan SDK de cuatro roles/anonimato; conservan enlaces de logos y bloquean mutaciones/listado. |
| Functions | **Build/lint aprobados** | Sin errores ni advertencias de lint en la ejecución actual. |
| Angular producción | **Build aprobado** | Artefacto `dist/pediatrify/browser`; descarga de fuentes públicas autorizada. |

Grupos separados: no representan porcentaje de cobertura ni ensayo desplegado. Emuladores exclusivamente `demo-lilcare-p01`, Firestore `127.0.0.1:8187`, Storage `127.0.0.1:9199`, datos sintéticos y Auth/SMTP simulados. La suite histórica `firestore.rules.spec.mjs` comprueba el prototipo; la suite actual es `firestore.integration.rules.spec.mjs`.

## Activación completada

- [x] Cliente, sesiones, escritores, proyecciones, consultas, publicaciones, correo y avisos.
- [x] Cambios de correo, invitaciones y bajas del personal con autoridad/sesión actuales.
- [x] Reglas raíz, índices, Storage y pruebas directas de los cuatro roles.
- [x] Herramientas revisables D04/D07/D08 y rotación de claves.
- [x] Plan y artefactos de ventana coordinada: [ACTIVACION_COORDINADA.md](ACTIVACION_COORDINADA.md).
- [x] Recorrido global P47: 51 templates y dos host bindings sin infracciones; Angular completo y producción aprobados.
- [x] Sincronización documental P46: cinco contextos y PROJECT; estructura/referencias verificadas.
- [x] ADC de operador autorizado, cuota configurada, lecturas Auth/Firestore y Firebase CLI comprobadas; reporte privado de autoridad preparado mediante lecturas.
- [x] Correspondencias del personal y decisiones sobre IDs revisadas; cinco filas candidatas, una invitación excluida, sin bloquear filas ni recrear cuentas. Huellas/roles/cuentas contrastados mediante lecturas.
- [x] Aplicar únicamente el reporte revisado durante mantenimiento: cinco filas idénticas a las revisadas previamente, una invitación pendiente excluida; UIDs, cuentas habilitadas y autoridad comprobados.
- [x] Provisionar secretos/parámetros autorizados conservando cuentas; firma del personal limitada a la propia cuenta runtime.
- [x] Publicar coordinadamente y verificar metadatos/servicios/reglas/índices del entorno. Hosting final publicado y mantenimiento retirado.
- [x] Registrar activación por componente. Ensayo externo omitido según D09, no marcado aprobado.

Evidencia del entorno en reportes privados ignorados de `review-plans/`: cuentas conservadas, reglas efectivas, índices listos, metadatos de las Functions habilitadas y Hosting. Raíz, Acceso paciente y entrada administrativa respondieron HTTP 200 con el mismo `index.html` del artefacto revisado, tanto en el dominio del consultorio como en Hosting. Son comprobaciones de publicación/configuración; no equivalen a iniciar sesiones reales o enviar correos.

Observaciones específicas exclusivamente en `../../PENDIENTES.md`. Auditoría candidata actual: [audit-integration.json](audit-integration.json). Producción/prototipo conservan sus auditorías históricas independientes.

## Comprobación reproducible

Desde raíz con Node 24/dependencias:
```powershell
npm --prefix functions run build
npm --prefix functions run lint
npx ng test --watch=false
npx ng build --configuration=production
node --test security/p01/operator-policy.spec.mjs security/p01/credential-key-policy.spec.mjs
```

Con Java 21, secuencialmente (las suites comparten reglas/datos):
```powershell
npx -y firebase-tools@latest emulators:exec --project demo-lilcare-p01 --only firestore,storage --config firebase.p01.emulators.json "node --test --test-concurrency=1 security/p01/firestore.integration.rules.spec.mjs security/p01/patient-credentials.emulator.spec.mjs security/p01/storage.integration.rules.spec.mjs"
npx -y firebase-tools@latest emulators:exec --project demo-lilcare-p01 --only firestore --config firebase.p01.emulators.json "node --test --test-concurrency=1 security/p01/clinic-operations.emulator.spec.mjs security/p45/admin-management.emulator.spec.mjs security/p01/clinic-auth.emulator.spec.mjs security/p01/credential-key-rotation.emulator.spec.mjs"
```

Fuentes oficiales de mecanismos: [tokens personalizados](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [verificación de ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [callables](https://firebase.google.com/docs/functions/callable).
