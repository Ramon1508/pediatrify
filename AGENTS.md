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
- Submit validation: empty required fields show `mat-error` "Este campo es obligatorio"; password min 6 chars on blur; confirm password match on blur
- File upload errors use alert service with `duration: 5000`
- After account creation: redirect to login with success alert "Tu cuenta ha sido creada" 5s
- Use reactive forms (`FormBuilder`, `Validators`) instead of template-driven (`ngModel`) for form validation
- `matPrefix` must be placed BEFORE `matInput` in DOM order for proper form field layout
- `$primary: #0D6E8F` in styles.scss
- `.gitignore` includes `/src/environments/`; env files removed from git history via `git filter-branch`

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
- Setup-profile: "(opcional)" labels, `submitted` flag for submit validation, password length and confirm match validation on blur, button validates on click; `max-width 880px` on inner content (`.setup-hero`, `.setup-form`) with `padding: 40px 200px` as outer spacing, `< 768px` `padding: 23px 16px`
- Login: redesigned without card, `Fondo.svg` background, logo + "Lilcare" title, `428px` max-width, button row with `justify-content space-between gap 24px` desktop, stacked `100%` mobile; "Iniciar sesión" button `width 202px` desktop
- File upload alerts with `duration: 5000`
- Login auth error messages unified to "Correo o contraseña incorrectos"
- Alert dialog button changed from dynamic `[color]` to static `color="primary"` → later changed to `class="btn-primary"`
- `$primary` reverted from `#01687D` back to `#0D6E8F`
- Environment files removed from git history via `git filter-branch --index-filter` and force-pushed to GitHub
- Fixed `matPrefix` position: moved before `matInput` in login and setup-profile fields to correct form field layout when errors display

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- `$primary` set to `#0D6E8F` (not `#01687D`) as the app-wide primary color; secondary uses same `#0D6E8F` hardcoded
- `!important` on `--mdc-filled-button-container-color` and background-color for primary buttons because MDC's internal theming overrides specificity otherwise
- Alert service rewritten from queue-based single-item to `signal<AlertItem[]>` supporting up to 5 concurrent alerts with individual timers and dismiss-by-ID
- Login validation: removed `[disabled]="loginForm.invalid"` so submit always validates; `submitted` flag triggers field errors
- Setup-profile button: removed `[disabled]="!canFinish"` dependency, now only `[disabled]="finishing"`; validation runs on click via `finish()`

## Next Steps
- Migrate login and setup-profile from template-driven (`ngModel`) to reactive forms (`FormBuilder`, `Validators`)

## Critical Context
- `NG8002` error in `alert-dialog.html` from `[color]` binding on `mat-unelevated-button` — fixed by using static `color="primary"` instead of dynamic expression
- `auth/invalid-credential` is the consolidated error in Firebase v12 for both wrong email and wrong password; unified message "Correo o contraseña incorrectos"
- Login container `max-width: 428px` desktop; mobile `100%` with `padding 0 16px`
- Login buttons stack vertically on mobile with `width: 100%` and `gap: 24px` (no `w-100-mobile` class needed, handled in scoped CSS)
- Setup-profile container `max-width: 880px` desktop with `margin: 0 auto`; mobile `100%`; padding `40px 200px` desktop (outer spacing), `23px 16px` mobile
- Primary button has `border: none` to prevent MDC default borders
- All primary buttons use `class="btn-primary"` (not `color="primary"`) for consistent styling; `.btn-primary` is self-contained with all button properties

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
