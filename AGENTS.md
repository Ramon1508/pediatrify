## Goal
- Build a complete UI system with consistent buttons, chips, alerts, and form validation for the Angular 21 pediatric clinic management app.

## Constraints & Preferences
- Primary button: `background #0D6E8F`, `color white`, `border-radius 12px`, `padding 16px 24px`, font `Roboto 500 16px/24px`, `letter-spacing 0.15px`, `vertical-align middle`, no elevation (`mat-unelevated-button`), no border
- Secondary button: transparent background, `border 1px solid #0D6E8F`, `color #0D6E8F`, same radius/padding/font as primary
- Tertiary button: same as secondary but no border
- Danger button: `background #B3261E`, same style as primary
- Chip: `padding 6px 16px`, `border-radius 8px`, `border 1px solid #0D6E8F`, `color #49454F`, font `Roboto 500 14px/20px`, `letter-spacing 0.1px`, `display inline-flex gap 8px`
- Chip-active: `background #0D6E8F`, `color #FFFFFF`, same padding/font as chip, white `mat-icon check` left
- All button custom classes (`.btn-secondary`, `.btn-tertiary`, `.btn-danger`) are self-contained (padding, font, border-radius)
- `.w-100-mobile` class for full-width on ≤768px, re-usable
- No `!important` on general properties (padding, font) but allowed on MDC overrides to force primary colors
- Alert system: multi-alert (max 5), individual timers, close button, `success` bg `#BFEDFA`, `error` bg `#F9DEDC`, `padding 14px 16px`, font `Roboto 400 14px/20px`, position `fixed center bottom 24px`, `min-width 344px` desktop, `100% width` mobile with `16px` padding horizontal
- Login layout: logo + "Lilcare" title + email + password + row of buttons (`btn-secondary` "Olvidé mi contraseña" left, primary "Iniciar sesión" right); desktop `max-width 428px`, mobile `100%`; mobile buttons stack vertically `width 100%` with `gap 24px`; "Iniciar sesión" width `202px` desktop
- Setup-profile container: `max-width 880px` desktop, `100%` mobile
- Optional fields get "(opcional)" in label
- Error messages in `mat-error` must be clear, descriptive, and phrased as instructions starting with a verb (e.g. "Ingresa una contraseña de al menos 8 caracteres."). Avoid generic messages like "Este campo es obligatorio" or "Requerido". Each message should tell the user what action to take.
- File upload errors use alert service with `duration: 5000`
- After account creation: redirect to login with success alert "Tu cuenta ha sido creada" 5s
- Use reactive forms (`FormBuilder`, `Validators`) instead of template-driven (`ngModel`). All form controls (including passwords) must be defined inside a single `FormGroup` so that `form.invalid` validates every field at once. Never use separate `FormControl` fields outside the group.
- Submit/save buttons use `[disabled]="formName.invalid || formName.pristine || loadingFlag"` so the button stays disabled while the form has errors, hasn't been touched, or a request is in flight. `submitted` flag triggers field error display.
- `matPrefix` must be placed BEFORE `matInput` in DOM order for proper form field layout
- `$primary: #0D6E8F` in styles.scss
- `.gitignore` includes `/src/environments/`; env files removed from git history via `git filter-branch`
- Use `@if` / `@for` (Angular 17+ control flow) instead of `*ngIf` / `*ngFor`
- Use semantic HTML elements for accessibility (`<button>` for buttons, `<nav>` for navigation, `<label>` for labels, etc.)
- All `<img>` and `ngSrc` images must have descriptive `alt` attributes

## Progress
### Done
- Global button styles (`border-radius 12px`, padding, font) for `.mat-mdc-unelevated-button`, `.mat-mdc-outlined-button` in styles.scss
- Primary button styles (`.btn-primary` class) with `background #0D6E8F`, `color white`, `border: none`; all 10 templates changed from `color="primary"` to `class="btn-primary"`
- Secondary, tertiary, danger button classes self-contained with all properties
- Chip (`.chip`) and chip-active (`.chip-active`) styles with 8px border-radius
- `.w-100-mobile` utility class for mobile full-width
- Global `--mdc-*-container-shape: 12px` and `--mat-sys-corner-full: 12px` for consistent radius
- All `mat-raised-button` replaced with `mat-unelevated-button` across 9 template files
- Alert system refactored: model (success/error types, `MAX_ALERTS=5`), service (`signal<AlertItem[]>`, `dismiss(id)`), overlay (multi-alert, animations, responsive positioning)
- Setup-profile: "(opcional)" labels, `submitted` flag, reactive forms, Sexo enum pattern, `max-width 880px`, padding `40px 200px` desktop / `23px 16px` mobile
- Login: redesigned without card, `Fondo.svg` background, reactive forms, `428px` max-width, button row, `202px` submit button
- File upload alerts with `duration: 5000`
- Login auth error messages unified to "Correo o contraseña incorrectos"
- Alert dialog button changed from dynamic `[color]` to static `class="btn-primary"`
- `$primary` reverted from `#01687D` back to `#0D6E8F`
- Environment files removed from git history via `git filter-branch --index-filter` and force-pushed to GitHub
- Fixed `matPrefix` position: moved before `matInput` in login, setup-profile, and patient-login fields
- Created `Sexo` enum in `core/models/sexo.ts` and migrated setup-profile to numeric DB values
- Fixed accessibility: added missing `alt` to file-upload preview image
- Removed `color="warn"` from icon buttons (doctors, patients); `mat-button color="warn"` → `mat-unelevated-button class="btn-danger"` (appointments)
- Added `btn-secondary` class to toggle button in appointments; removed `color="primary"` from calendar add-btn
- Fixed patient-login validation: removed `[disabled]="otpForm.invalid"`, uses `submitted` flag pattern
- Updated AGENTS.md with Angular 17+ control flow, semantic HTML, alt attributes rules

### Done (continued)
- Patient model expanded: `birthDate`, `secondaryEmail`, `fatherName`, `motherName` fields; patient form redesigned with all new fields + validation
- Admin OTP customization: `setCustomOtp()` lets admin type a custom password; admin sees OTP input in dialog, employee sees only regenerate button
- Email normalization: `normalizeEmail()` utility trims+lowercases; `loginPatient()` normalizes input before lookup; all email stores normalized
- Calendar settings: `startTime`/`endTime` replaced with `timeSegments: FormArray` — multiple open segments per doctor with add/remove in settings panel
- Appointment editing: `editAppointment()` opens panel/dialog pre-filled; soft delete via `disabled: boolean` flag (appointments filtered with `!a.disabled`)
- Audit log system: `AuditEntry` model, `AuditRepository` (Firestore `auditLog` collection, `watchAll()` sorted by timestamp desc), `AuditLog` page component, route `/app/audit-log`
- Sidebar: added "Bitácora" nav entry for admin with `history` icon
- Audit logging wired into patient create/update and appointment delete
- Calendar: shows full 7-day week; unavailable days greyed out with `.disabled-header` / `.disabled-cell`; `isDayAvailable()` checks `availableDays`
- Calendar: admin doctor selector (`<mat-select>` in toolbar) — admin picks which doctor's schedule to view/manage
- `canInteractWithCell()`: returns `true` if day available OR user is admin (admins can schedule on greyed cells)
- `updatedBy` field on Appointment model (`user.ts`); all 3 `createAppointment()` calls (calendar, appointments scheduled+walk-in) set `updatedBy` to current user's email
- Detail card shows `updatedBy` when present
- `.btn-secondary` padding fix: added `!important` on `padding` and `height: auto !important` on base button class in `styles.scss` to prevent MDC overrides
- Budget for `anyComponentStyle` increased to `5kB` warning / `10kB` error in `angular.json`
- Created `FIRESTORE-INDEXES.md`: docs that no composite indexes are needed
- Created `SYSTEM-DOMAIN.md`: domain model docs (patients=children, tutors=parent users, appointments linked to patientId+doctorId)
- Replaced inline `form-error` display in login and setup-profile with the global alert service; removed `error` and `successMsg` class properties; cleaned up unused CSS
- Created `SpanishDateAdapter` (`core/adapters/spanish-date-adapter.ts`): extends `NativeDateAdapter`, overrides `getFirstDayOfWeek()` to return `0` (Sunday); configured in `app.config.ts` with `MAT_DATE_LOCALE: 'es-MX'`
- **Fix de zona horaria en fechas `YYYY-MM-DD`**: `NativeDateAdapter.parse` usa `new Date(Date.parse(value))`, que interpreta el string como medianoche UTC → en zonas negativas (GMT-7) muestra el día ANTERIOR (bug al reagendar cita: el picker resaltaba el 17 cuando la fecha guardada era el 18). `SpanishDateAdapter.parse` (override) ahora interpreta `YYYY-MM-DD` a medianoche LOCAL (`new Date(y, m-1, d)`). Esto arregla TODOS los datepickers que prefijan con string, no solo citas
- **Además, el `mat-datepicker` NO llama a `parse` al prefijar un string** (usa su propio `Date.parse`), así que el `SpanishDateAdapter.parse` solo cubre el caso de input manual. Por eso los prefills de formulario ahora mandan un **`Date` local** vía `dateStringToLocalDate()` (`core/utils/date-utils.ts`) en los diálogos de cita, editar/completar perfil de paciente; y al guardar se vuelve a string con `dateToString()`/`toDateString()`. `Appointment.date` sigue guardándose como string `YYYY-MM-DD` en Firestore.
- Changed `getMonday` → `getWeekStart` in calendar so grid starts on Sunday (`d.setDate(d.getDate() - d.getDay())`), matching the Material datepicker mini calendar
- Migrated **patient-login**, **doctors**, **patients**, **calendar** (dialog), and **appointments** (walk-in + dialog) from template-driven (`ngModel`/`FormsModule`) to reactive forms (`FormBuilder`/`ReactiveFormsModule`)
- Removed `FormsModule` imports from all 5 migrated pages
- Replaced `mat-select` with `mat-autocomplete` for patient search in calendar appointment panel and dialog — search filters patients by name/lastname
- Added `+ Añadir nuevo paciente` button below patient search in both new appointment panel and dialog
- Created new patient side panel: full form (name, lastName, birthDate, email, secondaryEmail, fatherName, motherName, phone), email duplicate detection with "Continuar" flow, auto-select after creation, patient list refresh
- Added `patientSearchControl`, `filteredPatients` signal, `filterPatients()`, `onPatientSelected()`, `displayPatientFn()`, `onPatientSearchFocus()` methods to Calendar component
- Added CSS: `.add-patient-btn`, `.new-patient-alert`, `.alert-continue-btn`, `.panel-subtitle`

### Done (continued)
- Appointments inline dialog refactored into standalone `AppointmentFormDialog` component (`pages/appointments/dialogs/appointment-form-dialog/`) with `setPatients()`/`setEditData()` pattern matching other dialog components
- `.btn-secondary`, `.btn-tertiary`, `.btn-danger` made fully self-contained: each class now declares all properties (padding, font, border-radius, etc.) instead of sharing a common selector block
- Added `border: none` to `.btn-danger` for consistency with `.btn-primary`
- Sidebar semantic HTML: `<div class="sidebar-nav">` → `<nav>`, `<div class="sidebar-footer">` → `<footer>`
- Appointments spec file rewritten to test dialog-based flow (mock `MatDialog.open` instead of inline dialog state)
- All 141 tests pass across 20 files (0 failures)

### Done
- Print preview fixed: CSS `page-break-after` / `page-break-before` / named `@page` didn't work in Angular context (Chrome ignored page breaks). Solution: `printViaNewWindow()` opens a new tab, clones the rendered `app-print-preview` DOM, injects fresh `@page { size }` + print CSS directly, and calls `print()` from the new window. 3 pages print correctly. Debug info div hidden with `.print-debug { display: none; }`.
- **Orientación de papel + cédulas en un renglón**: `PrintSettings` ahora tiene `orientation: 'horizontal' | 'vertical'` (default horizontal). `getPaperDimensions(size, customW, customH, orientation)` intercambia `width/height` cuando es vertical y se usa en `@page`/preview. En impresión se agregó un selector "Orientación" (Horizontal/Vertical). Además, en TODAS las vistas de impresión (`/print/:recordId` y `printSection`) las cédulas `CED. PROF.` + `CED. ESP.` van ahora en el MISMO renglón (`.print-field-row` / `.field-row`) para ahorrar espacio. Retrocompatible: docs guardados sin `orientation` caen a horizontal.

### Done (continued) — per-doctor patient records
- **Profile dialog** (`shared/components/profile-dialog/`): 456px, radius 20px, read/edit modes; admins+asistentes (`roles !== 'doctor'`) see only nombre+correo; logo link (solo si subido) + `FileUpload` in edit; snackbar "Cambios guardados."
- Header `account_circle` opens `ProfileDialog` directly (no `mat-menu`); spec updated
- **`saveAndPrint()`** in patient-history validates only the context's step form; dialog title always "Editar datos de la consulta" / button "Guardar e imprimir" when editing partially
- **`printSection()`** rewritten: uses `PrintSettingsRepository`, paper/margins/logo del doctor, layout similar to `/print/:recordId`; `usePreloadedLogo` selects `doctor.logoPath`
- Sticky "Vacuna" column in vaccination tables (edit-patient + complete-profile dialogs): `position: sticky; left: 0`, `border-collapse: separate`
- **`PatientRepository`**: `deletePatient(ids[])`, `getPatientsByDoctor()`, `findPatientsByLoginEmail()` (primary+secondary via two `where` queries, deduped by doc id)
- **`ClinicalRecordRepository`**: `deleteMany()`, `getByPatient()`; **`AppointmentRepository`**: `deleteAppointments(ids)`, `getByPatient()`, `getAllByDoctor()`
- **`CascadeService`** (new): `deletePatientCascade()` (records + appointments + patient doc), `deleteDoctorCascade()` (patients cascade + appointments + user doc); wired into patients, patient-history, delete-doctor-dialog
- **`loginPatient()`**: uses `findPatientsByLoginEmail()` + `otpPassword` match (no full-collection scan)
- **`new-patient-dialog`**: duplicate-email check scoped to current doctor (`doctorScope`/`scopePatients`)
- **Profile dialog logo preview**: `FileUpload` accepts `initialPreview`/`initialFileName` inputs synced via `effect()`; when a doctor already has a logo uploaded, edit mode shows it as loaded (image + filename + remove button) instead of an empty "Subir archivo" area; `switchToEdit()` re-resolves the URL if not yet loaded
- **Test isolation fixed at root**: Angular's `@angular/build:unit-test` hardcodes `isolate: false`, so `vi.mock('firebase/firestore', ...)` from one spec (invite-doctor-dialog, settings-dialog, admin-init) leaked into others and broke real `FirebaseService`/repositories intermittently. Fixed via `vitest-base.config.ts` (`test.isolate: true`) + `runnerConfig: true` in angular.json. ~2x slower (~15-23s vs ~9s) but deterministic
- **`appointments.spec`**: now mocks `UserRepository` + `AuditRepository` (its real deps) so it never touches Firebase
- **Setup-profile por rol**: `isAssistant` renombrado a `isNonDoctor` (cierto para `role === 'assistant' || role === 'admin'`); no doctores ven solo contraseña + confirmación (hero "Bienvenido", botón "Finalizar"), sus campos doctor se limpian de validators (`clearValidators` en sexo/phone/cedula/consultorios) y `finish()` guarda `Sexo.Otro`/`''`; doctores conservan el formulario completo; funciona en modo invitation y existing
- **Correo de acceso al paciente**: nueva cloud function `sendPatientAccessEmail` (`functions/src/index.ts`, mismo patrón SMTP + `checkAndIncrementCounter`), cliente `EmailService` (`core/services/email.service.ts`, POST a `https://us-central1-lilcare-afdf5.cloudfunctions.net/sendPatientAccessEmail`); `new-patient-dialog` envía el correo tras `createPatient` y `patients.regenerateOtp()` al regenerar OTP; si el correo falla el paciente ya existe y solo se muestra alerta de error (envío no bloqueante)
- **Vitest concurrency**: `vitest-base.config.ts` ahora limita `maxWorkers: 6` + `hookTimeout: 30000` / `testTimeout: 20000`. Sin el límite, `isolate: true` lanzaba 1 worker por núcleo (12) y bajo presión de memoria los tests se colgaban (hooks >10s, archivos de ~15 min); con 6 workers el suite completo corre en ~20-25s
- **250 tests pass (35/35 files)** — suite completo estable con `ng test --watch=false`
- **Ojo**: un `ng serve` viejo corriendo en segundo plano degrada fuertemente los tests (pasaban de ~2s a 35s por archivo); si los tests se ralentizan, revisar procesos `node/esbuild` sobrantes
- **"Ver historial" en appointment-detail-card**: ya navega a `/app/patients/history/:patientId` (`appointment-detail-card.ts`), y `patients.viewHistory()` maneja el output del `appointment-card`; route existe en `app.routes.ts`
- **Calendar a11y**: date picker, time slot cells, appointment blocks y mobile cards ya son `<button>`; el overlay del detalle (`detail-overlay`, `role="button"` con `tabindex="0"`) ganó handlers `keydown.enter`/`keydown.space` para cerrar
- **`profile-dialog.spec`** (nuevo): 12 tests (modo lectura doctor/asistente, switchToEdit, cancelEdit, save ok/inválido/error, close con confirm, logout); mockea `firebase/storage` + `AuthService`/`UserRepository`/`Router`
- **262 tests pass (36/36 files)** — suite completo con `ng test --watch=false`
- **`sendPatientAccessEmail` desplegada** a producción (`firebase deploy --only functions:sendPatientAccessEmail`, exitosa); el lint de `functions` tenía 2 errores de comillas que se corrigieron con `eslint --fix` desde `functions/`
- **Alert-overlay z-index**: verificado — `:host` con `z-index: 10000` (sin stacking context en `html`/`body`/`app-root`), por encima del `.cdk-overlay-container` (z-index 1000) y de cualquier z-index de la app; los toasts ya aparecen sobre los diálogos. No hubo problema real

### Done (continued) — vistas por rol (admin / doctor / asistente)
- **Flujos por rol** (decidido en Q&A): **admin** sin sidebar y solo página de doctores (ver/alta/baja/modificar doctores, no asistentes); lo registra un creador desde la DB (rol lo define el creador); completa registro solo con contraseñas; login → `/app/doctors`. **asistente** sin sidebar, lo registran los doctores; completa registro solo con contraseñas; ve solo el calendario de su doctor asignado; puede agendar y crear pacientes nuevos desde el panel de cita, pero NO ver/editar perfil del paciente ni historial. **doctor** registra asistentes y conserva sidebar (Calendario, Pacientes, Asistentes, Impresión)
- **Invitación sin selector de rol**: `invite-doctor-dialog` eliminó `roles[]` + control `role`; `targetRole` se deriva del invitador (`admin`→`'doctor'`, si no→`'assistant'`); títulos dinámicos "Invitar doctor"/"Invitar asistente"; registrar un doctor pide lo mismo que un asistente (nombre + correo → enlace); quitado `MatSelectModule`
- **`doctors.ts` role-aware**: admin filtra `role === 'doctor'` (todos); doctor filtra `role === 'assistant' && createdBy === current.uid` (sus asistentes); labels dinámicos `pageTitle`/`addLabel`/`emptyLabel`/`editLabel`/`deleteLabel`
- **`edit-doctor-dialog`** y **`delete-doctor-dialog`**: títulos/mensajes dinámicos según `doctor.role` ("Editar doctor"/"Eliminar doctor" vs "Editar asistente"/"Eliminar asistente")
- **`app.routes.ts`**: calendar → `['doctor','assistant']`; patients, patients/history, impresion → `['doctor']`; doctors → `['admin','doctor']`; **entrada `audit-log` eliminada** (admin ya no tiene bitácora)
- **`doctor-layout`**: `showSidebar` solo `role === 'doctor'` (admin y asistente sin sidebar)
- **`login.ts`**: redirect post-login por rol — admin → `/app/doctors`, resto → `/app/calendar` (si `profileComplete`)
- **`sidebar.ts/html`**: reemplazados `isAdmin`/`isAdminOrDoctor` por `isDoctor`; nav solo doctor (Calendario, Pacientes, Asistentes `group`, Impresión `print`); entradas admin/bitácora eliminadas
- **`appointment-detail-card`**: getter `isAssistant` (inyecta `AuthService`); "Ver historial" oculto para asistentes
- **Specs actualizados**: `doctors.spec` reescrito (labels por rol, filtro `createdBy`, `TestBed.resetTestingModule()` para el caso doctor), `invite-doctor-dialog.spec` (sin selector, titles/`targetRole` por inviter), `edit/delete-doctor-dialog.spec` (titles/mensajes por rol del sujeto), `sidebar.spec` (`isDoctor`, sin Bitácora/Asistentes/Impresión para admin/assistant), `login.spec` (admin → `/app/doctors`)
- **265 tests pass (36/36 files)** — suite completo con `ng test --watch=false` (~55s) + `ng build` OK

### Done (continued) — módulo de notificaciones
- **Modelo** (`core/models/notification.ts`): `AppNotification` (id, type, title, description, appointmentId opcional, createdAt, originatorId/Name, `recipientIds[]` para la query, `recipients[]` con estado de lectura POR destinatario `{ recipientId, recipientType, read }`); `NotificationType` ('appointment-created' | 'appointment-cancelled' | 'appointment-rescheduled'); arquitectura extensible a nuevos tipos sin tocar el componente visual
- **`NotificationRepository`** (colección `notifications`): `create()`, `watchForRecipient(recipientId)` (query `orderBy('createdAt','desc')` + `limit(100)` y filtro cliente por `recipientIds.includes` — SIN índice compuesto), `markRead(docId, recipientId)`, `markAllRead()` (escribe el array `recipients[]` con el flag del destinatario)
- **`NotificationService`** (lógica de negocio; el visual solo consume): `notifyAppointmentCreated/Rescheduled/Cancelled`; construye descripciones en español (`dd/mm/yyyy` + hora); `buildRecipients()` añade doctor propietario + sus asistentes + paciente, y **si el doctorId es un asistente** resuelve su `createdBy` hacia el doctor dueño de la agenda (asistentes crean citas con `doctorId = asistente`); tras verificar reglas, **el admin nunca es destinatario** (`primary.role === 'admin'` se ignora); en **pacientes se notifica a toda la familia**: `addPatientFamily()` usa `PatientRepository.findPatientsByLoginEmail(email)` sobre el `email` y `secondaryEmail` del paciente para incluir a todos los hijos que comparten el mail del tutor (el padrón puede tener 1, 2, … N hijos); el actor queda `read: false` como todos los destinatarios (prueba temporal del usuario: TODOS los recipients arrancan `read: false`; ver "Prueba temporal" en Key Decisions); los fallos de notificación quedan aislados (catch interno, nunca rompe la operación de la cita)
- **`UserRepository.getAssistantsByDoctor(doctorUid)`**: query single-field `where('role','==','assistant')` + filtro `createdBy` en cliente (sin índice compuesto)
- **Components**: `app-notification-bell` (mat-icon-button `notifications` envuelto en `.notification-button-wrapper` que lleva el `[matBadge]` rojo `#B3261E` texto blanco, `matBadgeHidden` cuando `unreadCount() === 0`, `matBadgePosition="above after"`; **sin `matBadgeSize="small"`** — el tamaño pequeño de Material fija `font-size: 0` y el número se ve como un simple punto; el estilo del badge (fondo, color, `font-size: 10px`) vive en `styles.scss` GLOBAL porque el `<span class="mat-badge-content">` lo crea Material dinámicamente y NO recibe el atributo de scoping `_ngcontent` de Angular, por lo que los estilos scoped del componente nunca le aplican; fondo del bell `#BFEDFA`, radius 16px, padding 6px 20px, icono `#4A4459`, gap 8px con el perfil; abre el diálogo) y `app-notifications-dialog` (MatDialog `panelClass: 'notif-panel'`; título "Notificaciones", cierre `close`, radio Todos / Sin leer, estado vacío "Aún no tienes notificaciones.", item con indicador circular `#0D6E8F` + título + descripción + acción "Ver detalles" solo si la cita sigue existiendo (`getAppointment` → null/`disabled:true` oculta el enlace), divisor). **Abrir el diálogo NO marca leídas ni modifica el contador; solo "Ver detalles" llama `markRead(notificationId, recipientId)`**
- **"Ver detalles" navega por rol**: doctor → `/app/patients/history/:patientId`; asistente → `/app/calendar`; no muestra el enlace si la consulta no existe o fue deshabilitada
- **Diálogo posicionado en `styles.scss`**: `.notif-panel` anclado arriba-derecha (right 40px / top 64px, debajo del header, ancho 420px) con elevación Material; surface con `height: auto; min-height: 168px; max-height: min(560px, calc(100dvh - 88px))`; en ≤768px ocupa todo el ancho/alto bajo el app bar (full-screen pasando el contexto) conservando encabezado y filtros fijos; el único scroll es `.notifications-list` (flex `1 1 auto`, `min-height: 0`, `overflow-y: auto`) — nunca `overflow-y` en el contenedor del diálogo, ni altura fija 168px
- **Header**: `<app-notification-bell />` a la izquierda del botón de perfil (gap 8px)
- **Admin excluido de notificaciones**: el bell se oculta por completo para `role === 'admin'` (`recipientId` retorna `null`); el diálogo tampoco arma destinatario para admin (defensa en profundidad); `buildRecipients()` ignora usuarios con `role === 'admin'` como doctor propietario
- **Paciente notificado por familia**: el destinatario paciente NO es solo el hijo de la cita sino TODA su familia (padres/tutores con 1…N hijos); `addPatientFamily()` busca por `findPatientsByLoginEmail` con el `email` y `secondaryEmail` del paciente y añade cada hijo como recipient (un padre puede tener más de 1 hijo)
- **Generación automática**: cita agendada (2 diálogos de cita), reagendada (mismo diálogo cuando cambia date/time), cancelada (calendar `doCancelAppointment`, appointments `cancelAppointment`, patients `cancelAppointment`); el creador queda `read:true`
- **Specs nuevos**: `notification.service.spec.ts` (contador/recipients, descripciones created/cancelled/rescheduled, aislamiento de fallos, asistente→doctor dueño, familia con hermanos compartiendo email, admin excluido), `notification-bell.spec.ts` (10: badge oculto/conteo real, abre diálogo, no marca leídas al abrir, oculta bell para admin), `notifications-dialog.spec.ts` (7: empty state, listado sin marcar leídas al abrir, filtro Sin leer, enlace según existencia de cita, "Ver detalles" marca `markRead` + navega doctor, close, admin no marca leídas); specs afectados (appointment-dialog, appointment-form-dialog, calendar, appointments, patients, header) actualizados con mock de `NotificationService`
- **284+ tests pass (39/39 files)** — suite completo con `ng test --watch=false` + `ng build` OK

### Done (continued) — rediseño de notificaciones (estado global, caché, paginación)
- **Arquitectura**: lógica separada en 3 conceptos — conteo global de no leídas (badge), caché de notificaciones cargadas, paginación/infinite scroll; todo centralizado en `NotificationService` (signals); diálogo/bell son solo presentacionales
- **Regla de lectura**: abrir el diálogo, cambiar filtro, hacer scroll, recibir notificación o cerrar NO marcan leído; solo "Ver detalles" marca ESA notificación (por destinatario) y actualiza el contador global
- **`NotificationService`** reescrito: signals `unreadCount` (inicializado en `onSessionChange()` con `refreshUnreadCount()` real vía `repo.countUnread` — el conteo del badge es el real del backend, no un valor fijo), `activeFilter`, `isInitialLoading`, `isLoadingMore`, `hasMoreAll`, `hasMoreUnread`, `notifications`/`hasMore` computados por filtro, `recipientId`; cachés independientes `allCache`/`unreadCache` y cursores `allCursor`/`unreadCursor` (paginación de "Todos" y "Sin leer" totalmente independiente); `onSessionChange()` vía `auth.session$` (teardown + reset + `refreshUnreadCount` + realtime + `loadFirstPage`); `loadFirstPage(filter)` con dedupe por id y sincronización de `newestKnownAt`; `loadMore()` con guard `isLoadingMore`/`hasMore`; `setFilter(filter)` carga solo si la caché de ese filtro está vacía; `markAsRead(id)` actualiza `recipients`+`unreadFor` en `allCache`, remueve de `unreadCache` y decrementa `unreadCount` (floor 0); `refresh()` limpia/reconstruye; realtime solo hace prepend de items MÁS RECIENTES que `newestKnownAt` (sin bulk prepend de históricos) y sin duplicar (`knownIds`)
- **`NotificationRepository`** reescrito: `getPage(recipientId, filter, pageSize, lastVisible)` con `array-contains` + `orderBy('createdAt','desc')` + `startAfter` → `NotificationPage { items, lastVisible }`; `countUnread()` con `getCountFromServer`; `create()` persiste `unreadFor`; `markRead()` actualiza `recipients` + `unreadFor`; se conservan `watchForRecipient` y `markAllRead`
- **Modelo**: `NotificationFilter = 'all' | 'unread'` y `unreadFor?: string[]` en `AppNotification`
- **`NotificationBell`** consume el servicio (badge = conteo global, no lo cargado); abre `NotificationsDialog` con `panelClass: 'notif-panel'`, `backdropClass`, `maxWidth: '100vw'`, `maxHeight: 'calc(100dvh - 88px)'`
- **`NotificationsDialog`**: skeleton en carga inicial, radio Todos/Sin leer (usa señales del servicio), infinite scroll con umbral 80px → `loadMore`, spinner `isLoadingMore`, mensaje "Has llegado al final…" cuando `!hasMore()`; effect resuelve la cita (oculta "Ver detalles" si cancelada o no existe/disabled); `openDetails` → `markAsRead` → `CalendarFocusService.setFocus` → navega según rol (doctor → historial, asistente → calendario) → cierra
- **Specs reescritos**: `notification.service.spec` (generación, estado/paginación, lectura/contador, realtime), `notification-bell.spec` (5), `notifications-dialog.spec` (12), `header.spec` (provider `NotificationService` con signals)
- **Bug de test aislado**: `configure()` en service.spec recreaba `repoMock`/`userRepoMock`, así que los tests que configuraban mocks ANTES de `configure()` los perdían; ahora `configure()` recibe `firstPage` y `realtimeFn` opcionales. `TestBed.resetTestingModule()` al inicio de `configure()` evita el singleton root del servicio entre tests
- **Bug real corregido**: `applyPage()` dedupeaba contra `knownIds` global, así que cambiar al filtro "Sin leer" con IDs ya vistos en "Todos" descartaba todo (cache vacía); ahora dedupe por caché del filtro (los IDs no compartidos entre filtros)
- **`FIRESTORE-INDEXES.md`**: inicialmente 2 índices compuestos nuevos — `recipientIds` ASC + `createdAt` DESC y `unreadFor` ASC + `createdAt` DESC; el de `unreadFor` quedó en desuso cuando el filtro "Sin leer" pasó a client-side sobre `recipientIds` (solo crear `recipientIds` + `createdAt`)
- **308 tests pass (39/39 files)** + `ng build` OK (warning quill-delta no-ESM pre-existente, inofensivo)

### Done (continued) — nuevo paciente embebido en el diálogo de cita (sin drawer apilado)
- **Problema**: `AppointmentDialog.openNewPatientDialog()` abría un `NewPatientDialog` como segundo `MatDialog` con `panelClass: 'right-panel'`, apilado sobre el diálogo de cita (drawer sobre drawer, sin flecha de regreso)
- **Fix**: `NewPatientDialog` ahora es un componente reusable en 2 modos:
  - **Dialog standalone** (pacientes `patients.ts`): igual que antes, con botón `X` de cierre y `dialogRef.close(patient)` al guardar
  - **Emebbed** (`@Input() embedded = true`): se renderiza DENTRO del template de `AppointmentDialog` (mismo panel, nunca un segundo dialog); `MatDialogRef` inyectado con `{ optional: true }`; `close()` emite `back`; `save()` emite `saved` con el paciente creado; header muestra flecha `arrow_back` (`.btn-back-dialog`) en vez de `X`
  - `@Input() set allPatients` (getter/setter con `_allPatients` + `buildParentCache()`) para recibir la lista desde el padre embebido
- **`AppointmentDialog`**: `showNewPatient = signal(false)`; `@if (!showNewPatient())` muestra el form de cita, `@else` el `<app-new-patient-dialog [embedded]="true" (saved)="onPatientCreated($event)" (back)="goBackToAppointment()" />`; `openNewPatient()`, `goBackToAppointment()`, `onPatientCreated()` (recarga pacientes, autoselecciona al nuevo y regresa al form de cita); eliminado el `MatDialog` injection (ya no abre diálogos)
- **315 tests pass (39/39 files)** + `ng build` OK

### Done (continued) — "Ver detalles" inmediato en notificaciones
- **Problema**: el botón "Ver detalles" tardaba en aparecer porque `showDetails` dependía de `!!this.appointments()[n.id]`, que solo se llenaba tras `getAppointment` (una lectura Firestore por notificación, en cadena con `await` en el loop del `loadEffect`)
- **Fix en `notifications-dialog.ts`**:
  - `canShowDetails(n)`: el botón aparece de inmediato según `type !== 'appointment-cancelled' && !!appointmentId`; solo se oculta cuando la resolución ya confirmó que la cita no existe o fue deshabilitada (`resolved && appointment === null`)
  - `resolveAppointment()` con caché por `appointmentId`: `resolvedByAppointment` (resultado) + `inFlightAppointments` (promesa en vuelo) para no duplicar fetches; también escribe `map[n.id]` en las ramas de caché para que notificaciones que comparten `appointmentId` (created + rescheduled) oculten el botón ambas si la cita ya no existe
  - `openDetails()` resuelve la cita on-demand con `await resolveAppointment(n)` si aún no está en caché (el usuario puede clickear antes de que el `loadEffect` termine)
  - `Promise.resolve(getAppointment(...))` para tolerar retornos `undefined` (mocks/sin resultado)
- **Spec**: 16 tests (nuevos: "Ver detalles" visible de inmediato sin esperar el fetch usando un `deferred`; `openDetails` reutiliza el fetch en vuelo del `loadEffect` sin duplicarlo — `getAppointment` llamado 1 sola vez)
- **318 tests pass (39/39 files)** + `ng build` OK (warning quill-delta no-ESM pre-existente)

### Done (continued) — filtro "Sin leer" robusto + infinite scroll que llena el viewport + canceladas leídas al cerrar
- **Problema 1 — "Sin leer" lista vacía**: la query usaba `where('unreadFor','array-contains',...)` que depende de (a) el índice compuesto `unreadFor + createdAt` (aún sin crear en Console) y (b) que cada documento tenga `unreadFor` (las notificaciones creadas antes del rediseño no lo tienen); el error se tragaba silenciosamente y quedaba lista vacía
- **Fix**: `fetchPage()` en `notification.service.ts` — "Sin leer" ahora consulta por `recipientIds` (mismo índice que "Todos", ya existente) y filtra en cliente por `read === false` vía `isUnreadForRecipient()`; si una página cruda trae pocas/no trae no-leídas, se siguen pidiendo páginas hasta acumular `PAGE_SIZE` o agotar (evita que listas con muchas leídas entre medias dejen el filtro vacío); `applyPage` mantiene la paginación/cursor independiente por filtro
- **Problema 2 — infinite scroll que no carga**: el scroll solo se disparaba con evento `scroll`; con pocos items el contenedor no desborda, no hay scroll y nunca se pedía la siguiente página
- **Fix**: `fillEffect` en `notifications-dialog.ts` — tras renderizar, si `scrollHeight <= clientHeight` y hay `hasMore()`, dispara `loadMore()` (microtask vía `queueMicrotask`), llenando el viewport hasta que desborde o se agote
- **Canceladas leídas al cerrar**: `markCancelledRead()` en el servicio marca como leídas TODAS las notificaciones `appointment-cancelled` no leídas del destinatario actual (solo las cargadas en `allCache`); el diálogo lo dispara en `afterClosed()` (nuevo sub `closeSub`), por lo que ocurre al cerrar el diálogo y NO antes
- **Specs**: `notification.service.spec` (23 tests: "Sin leer" filtra leídas, markCancelledRead solo canceladas, flush helper `setTimeout(0)` porque `fetchPage` añadió un boundary async extra), `notifications-dialog.spec` (18 tests: auto-fill del viewport, `markCancelledRead` al cerrar, no marca antes de cerrar, mock de `dialogRef` con `close$` Subject + `afterClosed`)
- **Bug real corregido — canceladas no se marcaban en runtime**: `markCancelledRead()` solo recorría `allCache()` (lo paginado y cargado en el diálogo). Si una "Consulta cancelada" no estaba dentro de las páginas cargadas, nunca se marcaba como leída. Ahora `NotificationRepository.markAllCancelledRead(recipientId)` consulta Firestore por `recipientIds` (sin índice nuevo), filtra en cliente por `type === 'appointment-cancelled'` no leídas, hace `updateDoc` en batch y devuelve los ids; el servicio une esos ids con los de la caché antes de `markAsRead`, limpia ambas cachés. El badge se decrementa 100% LOCAL: las canceladas en caché vía `markAsRead()` (wasUnread) y las fuera de caché (`dbOnlyUnread`) con una resta directa de `dbMarked` — **NO se relee Firestore al final** porque `getCountFromServer` (`refreshUnreadCount`) es eventualmente consistente y justo después del `updateDoc` devuelve el conteo anterior, sobrescribiendo el decremento local y dejando el número sin cambiar
- **Badge real (antes TEMP bug)**: `unreadCount` se inicializa en `onSessionChange()` con `refreshUnreadCount()` → `repo.countUnread` real de Firestore (`unreadFor` array-contains + `getCountFromServer`); se eliminó la constante `TEMP_UNREAD_COUNT = 3` que fijaba el badge en un valor debug y lo desincronizaba del backend
- **Bug real corregido — autoscroll raro al abrir**: `fillEffect` encadenaba `loadMore()` sin límite al abrir (tras cada cambio de `notifications()` volvía a cargar hasta llenar el viewport), causando auto-cargado/salto visual al abrir el diálogo. Ahora hay `MAX_AUTOFILL_PAGES = 2` y `autoFillCount` que se resetea al cambiar de filtro: solo auto-carga máximo 2 páginas para llenar el viewport y luego solo carga vía `onScroll`
- **325 tests pass (39/39 files)** + `ng build` OK (warning quill-delta no-ESM pre-existente)
- **Regresión al escenario real del badge**: 3 tests nuevos — (1) `notification.service.spec` "does not double-decrement when the cancelled is both in the cache and in Firestore": si `markAllCancelledRead` devuelve la cancelada que ya está en `allCache`, el badge baja SOLO 1 (no 2) porque `cacheIds` filtra la cancelada de `dbOnlyUnread`; (2) `notification.service.spec` "reproduces the real badge flow: 5 notifications (4 created + 1 cancelled), reads 2, closes": `unreadCount` 5 → lee 2 (3) → cierra diálogo baja a 2 y la cancelada queda `read:true`; (3) `notifications-dialog.spec` "marks cancelled notifications as read on ESC / backdrop close (afterClosed path)": `dialogRef.close()` directo (ruta ESC/backdrop, sin pasar por `component.close()`) también dispara `markCancelledRead`. **328 tests pass (39/39 files)**

### Done (continued) — fix: canceladas que no se marcaban como leídas (runtime)
- **Síntoma**: con 5 notificaciones (4 creadas + 1 cancelada), tras leer 2 el badge mostraba 3 (correcto), pero la cancelada NO se marcaba como leída al cerrar el diálogo; `markAllCancelledRead` devolvía `[]`, así que el badge no bajaba a 2.
- **Causa raíz probable**: el filtro no-leído de `markAllCancelledRead` se basaba SOLO en `recipients[].read`, mientras que el contador del badge (`countUnread`) se alimenta de `unreadFor`. Si ambos se desincronizan (o el doc es viejo sin `unreadFor`), una cancelada que el badge sigue contando nunca se limpia. Además la query no traía `orderBy`, un patrón distinto al de `getPage` (que sí funciona), susceptible a paginación no determinista con `startAfter`.
- **Fix en `notification.repository.ts` `markAllCancelledRead()`**: ahora (a) usa `orderBy('createdAt','desc')` — mismo índice compuesto `recipientIds` ASC + `createdAt` DESC que ya usa `getPage` y funciona; (b) decide "no leída para el destinatario" con `unreadFor.includes(recipientId)` como fuente de verdad (con respaldo a `recipients[].read` para docs antiguos). Así cualquier cancelada que el badge cuente queda limpiada en `unreadFor` y no se "atasca".
- **Fix en `notification.service.ts`**: nuevo helper `isUnreadForBadge()` (fuente de verdad `unreadFor`, respaldo a `recipients`) y `isUnreadInCache()` ahora usa ese helper. Así `markAsRead`/`markCancelledRead` decrementan el contador exactamente cuando la notificación estaba contada por el badge (evita sobre/sub-decrementos por inconsistencia de datos).
- **««`notification.repository.spec.ts` (NUEVO, 6 tests)»»**: fake in-memory de `firebase/firestore` para cubrir la lógica REAL del repositorio (CRUD de canceladas + paginación). Casos: orden `array-contains`+`createdAt`, `countUnread` por `unreadFor`, `markRead` por destinatario + limpieza de `unreadFor`, canceladas no-leídas, cancelada con `recipients.read=true` pero en `unreadFor` (se limpia), paginación con 150 docs (`PAGE=100`).
- **2 tests de INTEGRACIÓN (en el mismo `notification.repository.spec.ts`)**: `NotificationService` REAL + `NotificationRepository` REAL (fake Firestore) + mock de Auth. Replay exacto del flujo del usuario: 5 notificaciones (4 creadas + 1 cancelada) → cuenta 5 → lee 2 (3) → `markCancelledRead` (2) y la cancelada (la más antigua, en página 2 FUERA de la caché) queda marcada leída en Firestore y fuera de `unreadFor`. Verifica la sinergia servicio↔repo, incluida la cancelada que no está en la caché cargada. **336 tests pass (40/40 files)** — suite completo + `ng build` OK

### Done (continued) — badge = conteo real de la DB + auto-marcar canceladas al cerrar
- **Decisión de diseño (Q&A)**: el badge rojo es la fuente de verdad el conteo real de la DB; y al cerrar el modal las notificaciones `appointment-cancelled` SÍ se marcan como leídas (para que no queden como no leídas para siempre, ya que no tienen "Ver detalles").
- **Badge en tiempo real (única fuente de verdad)**: `unreadCount` se setea SOLO por la subscripción `NotificationRepository.watchUnreadCount(recipient)` → `onSnapshot` sobre `where('unreadFor','array-contains', recipient)` → `snapshot.size`. `markAsRead`/`markCancelledRead`/`prependNew`/`refreshUnreadCount` **ya NO tocan `unreadCount`**: al leer (quitar el correo de `unreadFor`) o al crear una no leída, el `onSnapshot` re-emite y el número cambia solo. Se eliminó `countUnread`/`getCountFromServer` (el badge ya no depende de una petición puntual ni de decrementos locales).
- **`notifications-dialog.ts`**: el `constructor` solo hace `loadFirstPage` si la caché está vacía; el badge lo lleva la subscripción. Al cerrar (por `afterClosed` o `ngOnDestroy`, el primero que dispare) llama `markCancelledRead()` con guarda `cancelledMarked` para ejecutarlo UNA sola vez → marca las canceladas en la DB y el `onSnapshot` baja el badge solo.
- **`onSnapshot` sobre aggregate NO soportado**: la Firebase Web SDK v12.13.0 no acepta `onSnapshot` sobre aggregate queries (`count()`/`getCountFromServer`); `onSnapshot` solo acepta `DocumentReference`/`Query`. Por eso el conteo en vivo se hace con `onSnapshot` sobre la query `recipientId == me + read == false` y `snapshot.size` (cada usuario mira solo SUS docs).
- **Migración a modelo fan-out (decidido en Q&A)**: las notificaciones se crean como **un doc por destinatario** (`recipientId` + `recipientType` + `read`), en un solo `writeBatch`. Se eliminaron `recipientIds`, `recipients[]` y `unreadFor` (eran la fuente del desync). El estado de lectura ahora es un `read: boolean` por doc → sin joins, sin desync. `getPage('all'|'unread')` y `markAllCancelledRead` consultan por igualdad `where recipientId == me` (+ `read == false` / `type == appointment-cancelled`). Se eliminó `countUnread`/`getCountFromServer`.
- **332 tests pass (40/40 files)** + `ng build` OK

### Blocked
- Hotmail/Outlook delivery on turbo-smtp free plan — no fix possible from code

## Next Steps
- Crear en Firebase Console los 3 índices compuestos de `notifications` (modelo fan-out): `recipientId + createdAt DESC`, `recipientId + read + createdAt DESC`, `recipientId + type + read` (ver `FIRESTORE-INDEXES.md`)
- Validate manually the notifications flows at runtime: crear/cancelar/reagendar una cita genera notificación; badge cuenta no leídas; abrir el centro NO marca leídas ni cambia el contador; "Ver detalles" es la única acción que marca leída y navega (doctor → historial, asistente → calendario); el badge decrece solo tras cada usuario con "Ver detalles" (realtime vía `watchForRecipient`); oculto si la cita fue deshabilitada
- Validate manually que las notificaciones `appointment-cancelled` quedan leídas al CERRAR el diálogo (y no antes) y que el badge baja según lo marcado realmente en la DB
- Validate manually que "Sin leer" muestra no-leídas aunque haya muchas leídas entre medias, y que una lista corta auto-carga páginas hasta llenar el viewport
- Validate manually that admin never sees the bell, and that a parent with 2+ children (same login email) receives appointment-change notifications for all of them
- Validate manually the role flows at runtime: admin login → `/app/doctors` sin sidebar; doctor invita asistente (rol 'assistant'); asistente ve solo calendario sin "Ver historial"; asistente puede crear paciente nuevo al agendar
- Validate manually that patient login with `secondaryEmail` works at runtime
- Consider Cloud Function or Admin SDK for old auth cleanup when email changes
- Confirmar en runtime el flujo de canceladas al cerrar con la nueva cobertura de tests (328): el badge debe bajar exactamente 1 por cada cancelada no leída (en caché vía `markAsRead`, fuera de caché vía `markAllCancelledRead`), con X, ESC y backdrop

## Key Decisions
- Always use Angular Material components (`mat-dialog`, `mat-form-field`, `mat-button`, etc.) instead of custom HTML/CSS panels, overlays, or buttons. Avoid inline side panels with backdrop divs — use `MatDialog` with proper dialog components instead.
- **Every dialog/modal/card lives in its own individual component file.** If reused across multiple pages, place it under `src/app/shared/components/<name>/`. If page-specific, place it under `src/app/pages/<page>/dialogs/<name>/`. Never inline dialog HTML directly in a parent template.
- `$primary` set to `#0D6E8F` (not `#01687D`) as the app-wide primary color; secondary uses same `#0D6E8F` hardcoded
- `!important` on `--mdc-filled-button-container-color` and background-color for primary buttons because MDC's internal theming overrides specificity otherwise
- `!important` on `.btn-secondary` `padding` and `height: auto !important` on `.mat-mdc-unelevated-button` base class to prevent MDC inline height overrides
- Alert service rewritten from queue-based single-item to `signal<AlertItem[]>` supporting up to 5 concurrent alerts with individual timers and dismiss-by-ID
- Login validation: removed `[disabled]="loginForm.invalid"` so submit always validates; `submitted` flag triggers field errors
- Setup-profile button: removed `[disabled]="!canFinish"` dependency, now only `[disabled]="finishing"`; validation runs on click via `finish()`
- **OnPush change detection**: All components use `ChangeDetectionStrategy.OnPush` for performance. Components with `async` operations that modify non-signal state use `ChangeDetectorRef.markForCheck()` after the async change to ensure the view updates. Signal writes automatically mark the component dirty.
- **DB Enum pattern**: For multiple-choice fields (e.g. `Sexo`), store only a number in the DB; frontend uses a TypeScript enum to map number ↔ label. This keeps DB portable and avoids string storage.
- **Registration vs update flow**: New records are created ONLY in two places: (1) `AdminInitService.ensureAdminExists()` creates the initial admin pending document, (2) admin invitation creates pending documents for doctors. `registerFromInvitation` UPDATES the existing pending document in-place (never creates a new one). `completeProfile` also UPDATES the existing user document. Both use `updateUser` on the pending/existing document ID. User documents store `firebaseUid` for login lookup and `pending: false` to prevent `ensureAdminExists` from creating duplicates.
- **Role system**: roles are `'admin' | 'doctor' | 'assistant'`. Admin + assistant have NO sidebar; only doctor keeps the sidebar. Admin only route is `/app/doctors` (manages doctors, not assistants); assistant only `/app/calendar` (its assigned doctor's schedule). `roleGuard` arrays in `app.routes.ts` enforce this; page-level getters (`isDoctor`, `isAdmin`, `isAssistant`) read `AuthService.currentDoctor`.
- **Invite role is derived, never selected**: the inviter's role decides the target (`admin`→`doctor`, otherwise→`assistant`); there is no role selector in the invite dialog. A doctor's page shows only assistants where `createdBy === currentDoctor.uid`.

## Critical Context
- `NG8002` error in `alert-dialog.html` from `[color]` binding on `mat-unelevated-button` — fixed by using static `color="primary"` instead of dynamic expression
- `auth/invalid-credential` is the consolidated error in Firebase v12 for both wrong email and wrong password; unified message "Correo o contraseña incorrectos"
- Login container `max-width: 428px` desktop; mobile `100%` with `padding 0 16px`
- Login buttons stack vertically on mobile with `width: 100%` and `gap: 24px` (no `w-100-mobile` class needed, handled in scoped CSS)
- Setup-profile container `max-width: 880px` desktop with `margin: 0 auto`; mobile `100%`; padding `40px 200px` desktop (outer spacing), `23px 16px` mobile
- Primary button has `border: none` to prevent MDC default borders
- All primary buttons use `class="btn-primary"` (not `color="primary"`) for consistent styling; `.btn-primary` is self-contained with all button properties
- Calendar uses 7-day grid starting Sunday; `isDayAvailable()` checks `availableDays` from doctor settings; `canInteractWithCell()` allows admins to click greyed cells
- Admin doctor selector in calendar toolbar; `onDoctorSelected()` reloads that doctor's appointments+settings; `loadDoctorData()` called on init and on selection change
- `updatedBy` is set on every `createAppointment()` call; detail card conditionally displays it
- **Print preview**: Route `/print/:recordId` loads record + patient + doctor's print settings, renders full-page framed layout (logo/header/patient info + recommendations/prescription). Prints via `printViaNewWindow()`: opens a new tab, clones the rendered DOM, injects `@page { size }` + print CSS directly, calls `print()` from the new window (bypasses Angular CSS page-break issues).
- **Per-doctor patient data**: patient docs are independent copies per doctor (`doctorId` + own `otpPassword`); login with primary/secondary email scopes to the matching doctor; cascade deletes run client-side via `CascadeService`; duplicate-email checks are scoped to the current doctor
- **Profile dialog**: uses `FileUpload` for logo; `isSimpleProfile` = `roles !== 'doctor'` shows only nombre+correo; doctor email is `readonly` in edit
- **Vitest isolation**: `vitest-base.config.ts` sets `test.isolate: true` (Angular's unit-test builder defaults to `isolate: false`, which caused cross-file `vi.mock` leaks). Enabled via `runnerConfig: true` in the `test` target in `angular.json`. Also `maxWorkers: 6` + `hookTimeout: 30000` / `testTimeout: 20000` to avoid memory thrashing with one worker per core.

## Typography

| Class | Usage | Size | Weight | Line height | Letter spacing |
|-------|-------|------|--------|-------------|----------------|
| `.title-large` | Page titles, calendar date label | 22px | 500 | 28px | 0 |
| `.title-small` | Subtitles | 1.25rem (20px) | 500 | 1.75rem | - |
| `.title-medium` | Detail card patient name | 1.5rem | 500 | 2rem | 0 |
| `.body-large` | Paragraphs / values, "Motivo de la consulta" label | 1rem (16px) | 400 | 1.5rem | 0 |
| `.body-medium` | Motivo value text | 0.9rem | 400 | 20px | 0 |
| `.body-small` | Labels / metadata | 0.8rem | 400 | 1rem | - |
| `.label-large` | Mobile appointment cards | 14px | 500 | 20px | 0.1px |
| `.label-small` | Field labels | 0.8rem | 400 | 1rem | - |
| `.info-value` | Info value | 1rem | 400 | 1.5rem | - |

## Form layout patterns

| Element | Spacing |
|---------|---------|
| `.setup-body` padding (desktop) | `40px 200px` |
| `.setup-body` padding (mobile <768px) | `23px 16px` |
| `.setup-hero` margin-bottom | `24px` |
| `.form-row` gap (desktop) | `40px` |
| `.form-row` gap (mobile) | `0` |
| `.form-row` margin-bottom | `0.75rem` |
| `.full-width` margin-bottom | `0.75rem` |
| `.desktop-half` width | `calc(50% - 20px)` |
| Labels above value | `gap: 4px` between label and value |
| `.button-row` | `display: flex; justify-content: flex-end` |
| Section spacing | `0.75rem` to `1.25rem` |

### 2-column grid
```html
<div class="form-row desktop-2col form-gap-40">
  <mat-form-field appearance="outline" class="flex-field">...</mat-form-field>
  <mat-form-field appearance="outline" class="flex-field">...</mat-form-field>
</div>
```

### Validation with pattern
Use `pattern` to validate format without blocking typing. Mark field invalid and show `mat-error`:
```html
<mat-form-field appearance="outline">
  <mat-label>Phone</mat-label>
  <input matInput type="tel" [(ngModel)]="form.phone" name="phone" required
         minlength="10" maxlength="10" pattern="[0-9]*" #phoneModel="ngModel" />
  <mat-icon matPrefix>phone</mat-icon>
  @if (phoneModel.invalid && phoneModel.touched) {
    @if (phoneModel.errors?.['pattern']) {
      <mat-error>Only digits allowed</mat-error>
    } @else {
      <mat-error>10 digits required</mat-error>
    }
  }
</mat-form-field>
```

### Media query standard
```scss
@media (max-width: 768px) {
  flex-direction: column;
  gap: 0;
}
```

## Responsividad (estándar del sistema)

**Breakpoints** (variables en `styles.scss`): `$bp-mobile: 768px`, `$bp-tablet: 1024px`, `$bp-fold: 320px`.

- **Desktop** es el diseño base actual.
- **Tablet** mantiene la estructura desktop con ajustes menores de spacing (mismo layout, menos márgenes).
- **Mobile** inicia en `max-width: 768px`; aquí sí cambia la estructura (apila, full-width, etiquetas compactas).
- **Fold / ultra-small** (`≤ 320px`): revisar textos largos, botones y paddings (márgenes `12px`, botones `padding: 12px 16px`).

**Reglas aplicables en mobile:**
- Formularios y `action-row` se apilan (`flex-direction: column`) y los botones principales ocupan `width: 100%`.
- Usar `width: 100% + max-width`, no widths rígidos (evitar `width: 360px` solo; preferir `width: min(100%, 360px)`).
- `min-width: 0` en hijos flex/grid con texto; `.truncate` / `.wrap-anywhere` para overflow.
- En mobile, **todos los `MatDialog`** de captura, edición o flujo ocupan el área **entre el header de la app y la barra de navegación inferior** (no toda la pantalla): el pane se inseta con `top: var(--app-header-h, 56px)` y `bottom: var(--app-nav-h, 0px)`, `max-height: calc(100dvh - header - nav)`, sin `border-radius`, contenido con `overflow-y:auto`. Variables CSS en `:root`; `doctor-layout` setea `--app-nav-h` (64px si tiene sidebar, 0px si no — en ese caso el modal baja al `100dvh - header`). (Regla global en `styles.scss` para `:has(.mat-mdc-dialog-container)`; excepciones que se quedan como card: `cancel-dialog`, `context-card-panel`; `notif-panel` también es full-screen entre header/nav).
- **Excepción**: overlays/cards contextuales tipo menú o detalle rápido (p. ej. `appointment-detail-card` en el calendario) deben mantenerse como cards y NO convertirse en pantalla completa.
- Vistas densas no deben comprimirse; deben cambiar a lista, cards o acordeones conservando todas las acciones (patrón calendario).
- En mobile la **sidebar** se convierte en **barra de navegación inferior** (iconos, labels pequeños, footer oculto); el contenido (`main-content`) queda entre el header y la barra inferior.

**Utilidades globales reutilizables** (`styles.scss`): `.page-shell` / `.page-shell-contained`, `.page-header`, `.page-actions` / `.action-row`, `.responsive-grid`, `.responsive-card`, `.form-row-responsive`, `.desktop-only` / `.mobile-only`, `.w-100-mobile`, `.truncate`, `.wrap-anywhere`.

## Patrones clave de arquitectura

- **Standalone components**: Sin NgModules. Cada componente declara sus propios imports.
- **Lazy loading**: Cada página se carga con `loadComponent`.
- **Repositories**: Capa de acceso a datos. Los componentes llaman repositorios, no Firebase directamente.
- **Alert system**: `alertService.show()` dispara un overlay modal global.
- **Guards**: `authGuard` (autenticación), `roleGuard(['admin','employee'])` (roles), `profileGuard` (perfil completo).

## Firebase

Firestore rules en `firestore.rules` (abierto en desarrollo, restringir antes de producción).

## Relevant Files
- `src/styles.scss`: Global button styles, chip styles, `$primary: #0D6E8F`, `$danger: #B3261E`, MDC shape variables, `.w-100-mobile`, `.btn-secondary/tertiary/danger`
- `src/app/core/models/alert.ts`: `AlertType`, `AlertConfig`, `AlertItem`, `ConfirmOptions`, `MAX_ALERTS`
- `src/app/core/services/alert.service.ts`: Alert queue with `signal<AlertItem[]>`, `dismiss(id)`, 5-alert cap
- `src/app/shared/components/alert-overlay/`: Multi-alert overlay, animations, responsive positioning
- `src/app/pages/login/login.ts`, `.html`, `.scss`: Redesigned login, 428px container, button row, validation, 202px submit button, `text-wrap-mode: nowrap` on buttons
- `src/app/pages/setup-profile/setup-profile.ts`, `.html`, `.scss`: Submit validation, (opcional) labels, password validation, logo upload, 880px container
- `src/app/shared/components/file-upload/file-upload.ts`: Error alerts with 5s duration, `initialPreview`/`initialFileName` inputs for pre-loaded files
- `src/app/shared/components/profile-dialog/`: Perfil modal, read/edit modes, logo link + `FileUpload`, `isSimpleProfile`
- `vitest-base.config.ts`: `test.isolate: true` (fixes cross-file `vi.mock` leaks from Angular's `isolate: false` default)
- `angular.json` `test` target: `runnerConfig: true` loads the vitest base config
- `src/app/pages/doctors/doctors.ts`, `.html`: role-aware (admin → doctors, doctor → sus assistants `createdBy === current.uid`), labels dinámicos
- `src/app/pages/doctors/dialogs/invite-doctor-dialog/`: sin selector de rol, `targetRole` por inviter, títulos dinámicos
- `src/app/pages/doctors/dialogs/edit-doctor-dialog/`, `delete-doctor-dialog/`: títulos/mensajes dinámicos por rol del sujeto
- `src/app/app.routes.ts`: guards por rol (`calendar` doctor+assistant, `patients/history/impresion` doctor, `doctors` admin+doctor); `audit-log` eliminada
- `src/app/pages/doctor-layout/doctor-layout.ts`, `.html`: `showSidebar` solo doctor
- `src/app/pages/login/login.ts`: redirect post-login admin → `/app/doctors`
- `src/app/shared/components/sidebar/sidebar.ts`, `.html`: `isDoctor`, nav solo doctor (Calendario, Pacientes, Asistentes, Impresión)
- `src/app/shared/components/appointment-detail-card/`: `isAssistant` oculta "Ver historial"
- `src/app/core/models/notification.ts`: `AppNotification` (fan-out: `recipientId`, `recipientType`, `read`), `NotificationType`, `NotificationRecipient`
- `src/app/core/repositories/notification.repository.ts`: `createMany()` (writeBatch → un doc por destinatario), `getPage(recipientId, filter, pageSize, lastVisible)` por `recipientId == me` (+ `read == false` para 'unread'), `watchUnreadCount()` (onSnapshot + snapshot.size), `watchForRecipient()`, `markRead(id)` (updateDoc read=true), `markAllCancelledRead(recipientId)` (igualdad + batch updateDoc)
- `src/app/core/services/notification.service.ts`: genera notificaciones (created/cancelled/rescheduled) + `buildRecipients()` (dueño + asistentes + familia del paciente, con fallback asistente→doctor, admin excluido) + `addPatientFamily()`; `persist()` → `createMany()` (fan-out); `unreadCount` lo setea SOLO `startUnreadCountWatch()` (subscripción `watchUnreadCount`); `markAsRead`/`markCancelledRead`/`prependNew` NO tocan el badge
- `src/app/core/repositories/user.repository.ts`: `getAssistantsByDoctor(doctorUid)`
- `src/app/shared/components/notification-bell/`: botón campana `mat-icon-button` envuelto en `.notification-button-wrapper` (lleva el `matBadge` rojo, `matBadgeHidden` cuando `unreadCount() === 0`); contador realtime vía `watchForRecipient`; abrir el diálogo NO marca leídas ni modifica el contador
- `src/app/shared/components/notifications-dialog/`: diálogo de altura dinámica (`height auto; min-height 168px; max-height min(560px, calc(100dvh - 88px))`), header+filtros fijos, scroll SOLO en `.notifications-list`; abrir NO marca leídas; "Ver detalles" llama `markRead(notificationId)` luego navega; al cerrar dispara `markCancelledRead()` (por `afterClosed`/`ngOnDestroy`); el badge lo lleva la subscripción
- `src/styles.scss`: `.notif-panel` (dialog arriba-derecha debajo del header, surface con `height auto; min/max` dinámicos; ≤768px full-screen bajo app bar y solo la lista hace scroll) y `.notification-button-wrapper .mat-badge-content` (estilos GLOBALES del badge rojo del bell — necesarios porque el badge dinámico de Material no recibe los `_ngcontent` scoped)
- `src/app/shared/components/alert-dialog/alert-dialog.html`: `class="btn-primary"` static, no dynamic binding
- `tsconfig.app.json`: Added `"rootDir": "./src"`
- `.gitignore`: `/src/environments/` already present
