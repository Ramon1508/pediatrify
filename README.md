# Lilcare

Plataforma de gestión para consultorios pediátricos construida con **Angular 21**, **Angular Material** y **Bootstrap 5**.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Angular 21 (standalone components, sin NgModules) |
| UI primaria | Angular Material 21 (`mat-*` componentes, `mat-icon`) |
| UI utilitaria | Bootstrap 5.3.3 (grid, flexbox, utilidades) |
| Estilos | SCSS |
| Backend | Firebase v12 (Firestore, Auth, Storage) |
| Testing | Vitest 4 + jsdom |
| Paquetería | Yarn 1.22 (classic) |

---

## Prerrequisitos

- Node.js >= 18.20
- Yarn 1.22 (`corepack enable` o `npm i -g yarn@1`)

## Instalación

```bash
yarn install
```

## Servidor de desarrollo

```bash
ng serve
```

Navegar a `http://localhost:4200/`. Recarga automática al modificar archivos.

## Build

```bash
ng build
```

Los artefactos se generan en `dist/`. El build de producción optimiza performance y velocidad.

## Tests

```bash
ng test
```

Ejecuta unit tests con Vitest.

---

## Convenciones de estilo

### Bootstrap

Usar Bootstrap para **layout responsivo** y **utilidades**:

```html
<!-- Grid -->
<div class="container">
  <div class="row">
    <div class="col-12 col-md-6">...</div>
    <div class="col-12 col-md-6">...</div>
  </div>
</div>

<!-- Utilidades -->
<div class="d-flex align-items-center gap-2 mb-3">
<div class="text-center">
<div class="w-100">
```

### Angular Material

Usar Material para **componentes de formulario**, **botones** e **íconos**:

```html
<mat-form-field appearance="outline">
  <mat-label>Correo</mat-label>
  <input matInput />
  <mat-icon matPrefix>email</mat-icon>
</mat-form-field>

<button mat-raised-button color="primary">Guardar</button>
<button mat-raised-button class="btn-secondary">Cancelar</button>

<mat-icon>check_circle</mat-icon>
```

Los íconos de Material están disponibles vía CDN. Usar el nombre del ícono en snake_case.

---

## Sistema de botones

Todas las variantes heredan: `border-radius: 12px`, `padding: 16px 24px`, `font: Roboto 500 16px/24px`, `letter-spacing: 0.15px`, `width: fit-content`.

Las variables MDC se sobreescriben en `:root` y en el selector global de botones para asegurar el radio:
```scss
--mdc-filled-button-container-shape: 12px;
--mdc-outlined-button-container-shape: 12px;
--mat-sys-corner-full: 12px;
--mat-button-protected-container-shape: 12px;
--mat-filled-button-container-shape: 12px;
```

### Primary
```html
<button mat-raised-button color="primary">Acción</button>
```
Fondo `#01687D`, texto blanco.

### Secondary (outlined)
```html
<button mat-raised-button class="btn-secondary">Acción</button>
```
Borde `1px solid #0D6E8F`, texto `#0D6E8F`, fondo transparente.

### Tertiary (text only)
```html
<button mat-raised-button class="btn-tertiary">Acción</button>
```
Sin borde ni sombra, texto `#0D6E8F`, fondo transparente.

### Danger
```html
<button mat-raised-button class="btn-danger">Eliminar</button>
```
Fondo `#B3261E`, texto blanco. Mismas propiedades que primary (`background-color` y `color` explícitos).

---

## Chips

### Chip inactivo (selectable)
```html
<span class="chip">
  <mat-icon>check</mat-icon>
  Etiqueta
</span>
```
Borde `1px solid #0D6E8F`, texto `#49454F`, fondo transparente, `border-radius: 8px`, padding `6px 16px`, tipografía Label Large: Roboto 500 14px/20px, letter-spacing 0.1px.

### Chip activo
```html
<span class="chip-active">
  <mat-icon>check</mat-icon>
  Etiqueta
</span>
```
Fondo `#0D6E8F`, texto blanco, ícono check blanco a la izquierda, mismo padding y tipografía.

---

## Tipografía

Clases globales definidas en `styles.scss`:

| Clase | Uso | Tamaño | Peso | Altura línea |
|-------|-----|--------|------|-------------|
| `.title-large` | Títulos de página | 1.75rem (28px) | 500 | 2.25rem |
| `.title-small` | Subtítulos | 1.25rem (20px) | 500 | 1.75rem |
| `.body-large` | Párrafos / valores | 1rem (16px) | 400 | 1.5rem |
| `.body-small` | Labels / metadatos | 0.8rem | 400 | 1rem |
| `.label-small` | Etiquetas de campo | 0.8rem | 400 | 1rem |
| `.info-value` | Valor informativo | 1rem | 400 | 1.5rem |

---

## Layout de formularios

Patrón de espaciado usado en setup-profile y consistente en toda la app:

| Elemento | Espaciado |
|----------|-----------|
| `.setup-body` padding (desktop) | `40px 200px` |
| `.setup-body` padding (mobile <768px) | `23px 16px` |
| `.setup-hero` margin-bottom | `24px` |
| `.form-row` gap (desktop) | `40px` |
| `.form-row` gap (mobile) | `0` |
| `.form-row` margin-bottom | `0.75rem` |
| `.full-width` margin-bottom | `0.75rem` |
| `.desktop-half` width | `calc(50% - 20px)` |
| Labels sobre valor | `gap: 4px` entre label y valor |
| `.button-row` | `display: flex; justify-content: flex-end` |
| Espaciado entre secciones | `0.75rem` a `1.25rem` |

### Validación con pattern

Usar `pattern` para validar formato sin bloquear la escritura. El campo se marca como inválido y se muestra `mat-error`:

```html
<mat-form-field appearance="outline">
  <mat-label>Teléfono</mat-label>
  <input matInput type="tel" [(ngModel)]="form.phone" name="phone" required
         minlength="10" maxlength="10" pattern="[0-9]*" #phoneModel="ngModel" />
  <mat-icon matPrefix>phone</mat-icon>
  @if (phoneModel.invalid && phoneModel.touched) {
    @if (phoneModel.errors?.['pattern']) {
      <mat-error>Solo se permiten dígitos</mat-error>
    } @else {
      <mat-error>10 dígitos requeridos</mat-error>
    }
  }
</mat-form-field>
```

El botón se deshabilita si la validación falla (ej. `/^\d{10}$/.test(form.phone)` en `canFinish`).

### Grid de formularios (2 columnas desktop)

```html
<div class="form-row desktop-2col form-gap-40">
  <mat-form-field appearance="outline" class="flex-field">
    ...
  </mat-form-field>
  <mat-form-field appearance="outline" class="flex-field">
    ...
  </mat-form-field>
</div>
```

### Mobile full-width

Clase utilitaria global para que un elemento sea `width: 100%` solo en mobile (≤768px):

```html
<button mat-raised-button color="primary" class="w-100-mobile">Acción</button>
```

```scss
@media (max-width: 768px) {
  .w-100-mobile {
    width: 100% !important;
  }
}
```

### Media query estándar para mobile

```scss
@media (max-width: 768px) {
  flex-direction: column;
  gap: 0;
}
```

---

## Arquitectura del proyecto

```
src/
├── app/
│   ├── core/               # Servicios, modelos, guards, repositorios
│   │   ├── config/         # Constantes de configuración
│   │   ├── firebase/       # Capa de Firebase SDK
│   │   ├── guards/         # authGuard, roleGuard, profileGuard
│   │   ├── models/         # Interfaces y tipos
│   │   ├── repositories/   # Data access layer (Firestore)
│   │   └── services/       # auth, alert, admin-init
│   ├── pages/              # Lazy-loaded feature modules
│   │   ├── setup-profile/
│   │   ├── login/
│   │   ├── otp-login/
│   │   ├── dashboard/
│   │   ├── doctors/
│   │   ├── patients/
│   │   ├── appointments/
│   │   ├── calendar/
│   │   └── doctor-layout/
│   ├── shared/             # Componentes reutilizables
│   │   ├── header/
│   │   ├── sidebar/
│   │   ├── file-upload/
│   │   ├── alert-dialog/
│   │   └── alert-overlay/
│   ├── app.ts              # Root standalone component
│   ├── app.routes.ts       # Lazy route definitions
│   └── app.config.ts       # Providers globales
├── environments/           # environment.ts + environment.prod.ts
├── index.html
├── main.ts                 # bootstrapApplication
└── styles.scss             # Tema global, variables, overrides de Material
```

### Patrones clave

- **Standalone components**: Sin NgModules. Cada componente declara sus propios imports.
- **Lazy loading**: Cada página se carga con `loadComponent`.
- **Repositories**: Capa de acceso a datos. Los componentes llaman repositorios, no Firebase directamente.
- **Alert system**: `alertService.show()` dispara un overlay modal global.
- **Guards**: `authGuard` (autenticación), `roleGuard(['admin','employee'])` (roles), `profileGuard` (perfil completo).

---

## Firebase

Las credenciales están en `src/environments/environment.ts`. Usar `firebase.service.ts` para inicialización.

Firestore rules en `firestore.rules` (abierto en desarrollo, restringir antes de producción).

---

## Comandos útiles

```bash
# Generar componente
ng generate component pages/mi-pagina

# Build de producción
ng build --configuration production

# Watcher modo desarrollo
ng build --watch --configuration development
```

---

## Debugging

Configuración de lanzamiento en `.vscode/launch.json`:
- **Angular Dev Server**: Ejecuta `ng serve` y adjunta debugger al navegador.
- **Angular Test**: Ejecuta `ng test` en modo watch y adjunta debugger.
