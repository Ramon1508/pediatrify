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

### Blocked
- (none)

## Next Steps
- Wire up "Ver historial" action in appointment detail card (currently logs to console)
- Replace `<div>` click handlers with `<button>` in calendar (date picker, time slot cells, appointment blocks, mobile cards)
- Add dialog component spec files for individual coverage (appointment-form-dialog, invite-doctor-dialog, etc.)
- Verify composite Firestore index `appointments` `doctorId ASC + disabled ASC` is deployed
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
- `src/app/shared/components/file-upload/file-upload.ts`: Error alerts with 5s duration
- `src/app/shared/components/alert-dialog/alert-dialog.html`: `class="btn-primary"` static, no dynamic binding
- `tsconfig.app.json`: Added `"rootDir": "./src"`
- `.gitignore`: `/src/environments/` already present
