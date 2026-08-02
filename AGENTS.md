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
- Fixed `matPrefix` position: moved before `matInput` in login, setup-profile, and otp-login fields
- Created `Sexo` enum in `core/models/sexo.ts` and migrated setup-profile to numeric DB values
- Fixed accessibility: added missing `alt` to file-upload preview image
- Removed `color="warn"` from icon buttons (doctors, patients); `mat-button color="warn"` → `mat-unelevated-button class="btn-danger"` (appointments)
- Added `btn-secondary` class to toggle button in appointments; removed `color="primary"` from calendar add-btn
- Fixed otp-login validation: removed `[disabled]="otpForm.invalid"`, uses `submitted` flag pattern
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
- Changed `getMonday` → `getWeekStart` in calendar so grid starts on Sunday (`d.setDate(d.getDate() - d.getDay())`), matching the Material datepicker mini calendar
- Migrated **otp-login**, **doctors**, **patients**, **calendar** (dialog), and **appointments** (walk-in + dialog) from template-driven (`ngModel`/`FormsModule`) to reactive forms (`FormBuilder`/`ReactiveFormsModule`)
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

### Blocked
- Hotmail/Outlook delivery on turbo-smtp free plan — no fix possible from code

## Next Steps
- Validate manually the role flows at runtime: admin login → `/app/doctors` sin sidebar; doctor invita asistente (rol 'assistant'); asistente ve solo calendario sin "Ver historial"; asistente puede crear paciente nuevo al agendar
- Validate manually that patient login with `secondaryEmail` works at runtime
- Consider Cloud Function or Admin SDK for old auth cleanup when email changes

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
- `src/app/shared/components/alert-dialog/alert-dialog.html`: `class="btn-primary"` static, no dynamic binding
- `tsconfig.app.json`: Added `"rootDir": "./src"`
- `.gitignore`: `/src/environments/` already present
