# Lilcare

Plataforma de gestión para consultorios pediátricos construida con **Angular 21**, **Angular Material** y **Bootstrap 5**.

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

Navegar a `http://localhost:4200/`.

## Build

```bash
ng build
```

## Tests

```bash
ng test
```

## Modelo de negocio

### Jerarquía de usuarios

| Rol | Descripción |
|-----|-------------|
| **Admin** | Creado al inicializar la app. Puede registrar doctores. No tiene liga con ningún otro rol. Pueden existir múltiples admins. |
| **Doctor** | Registrado por un admin. No está ligado a un admin específico; cualquier admin puede administrar cualquier doctor. |
| **Assistant** | Ligado al doctor que lo registró. |
| **Patient** | Ligado al doctor que lo registró. Si un asistente registra un paciente, el paciente se liga al doctor que administra a ese asistente (no al asistente). |

### Reglas de borrado

| Acción | Efecto |
|--------|--------|
| Eliminar un paciente | Se borra todo lo referente al paciente. No afecta al doctor ni a los asistentes. |
| Eliminar un asistente | No afecta al doctor ni a los pacientes. |
| Eliminar un doctor | Se eliminan sus asistentes y sus pacientes. |

### Roles en el sistema

| Código (`UserRole`) | Etiqueta |
|---------------------|----------|
| `admin` | Administrador |
| `doctor` | Doctor |
| `assistant` | Asistente |

Los pacientes no se almacenan como usuarios de Firebase Auth. Usan OTP (contraseña temporal de un solo uso) para acceder.

## Testing: regla fundamental

**Ningún spec file debe escribir en Firebase real.** Todos los specs deben emular Firebase completamente:

- Usar `vi.mock('firebase/firestore', ...)` en el top-level cuando el componente importe funciones de Firestore (`setDoc`, `doc`, `getDoc`, etc.).
- Usar `vi.mock('firebase/auth', ...)` cuando el componente importe funciones de Auth.
- Proveer `FirebaseService` como un mock simple (`{ firestore: {} }` o `{ auth: {} }`) solo como token de DI, nunca como mecanismo para evitar escrituras.
- La combinación de `vi.mock` + mocks de servicios/repositorios garantiza que las pruebas nunca toquen una base de datos real.

## Test commands
```bash
ng test          # Run all tests in watch mode
ng test --no-watch  # Run all tests once
```

## Arquitectura

```
src/
├── app/
│   ├── core/               # Servicios, modelos, guards, repositorios
│   ├── pages/              # Lazy-loaded feature modules
│   ├── shared/             # Componentes reutilizables
│   ├── app.ts              # Root standalone component
│   ├── app.routes.ts       # Lazy route definitions
│   └── app.config.ts       # Providers globales
├── environments/           # environment.ts + environment.prod.ts
├── main.ts                 # bootstrapApplication
└── styles.scss             # Tema global
```

## Firebase

### Configuración de entornos

#### Angular app (`src/environments/`)

Archivos excluidos del repo vía `.gitignore`. Se requieren dos:

**`src/environments/environment.ts`** (desarrollo)
```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    authDomain: 'XXXXXXXXXXXX.firebaseapp.com',
    projectId: 'XXXXXXXXXXXX',
    storageBucket: 'XXXXXXXXXXXX.firebasestorage.app',
    messagingSenderId: 'XXXXXXXXXXXX',
    appId: 'X:XXXXXXXXXXXX:web:XXXXXXXXXXXXXXXXXXXXXX',
    measurementId: 'G-XXXXXXXXXX',
  },
};
```

**`src/environments/environment.prod.ts`** (producción)
```ts
export const environment = {
  production: true,
  firebase: {
    apiKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    authDomain: 'XXXXXXXXXXXX.firebaseapp.com',
    projectId: 'XXXXXXXXXXXX',
    storageBucket: 'XXXXXXXXXXXX.firebasestorage.app',
    messagingSenderId: 'XXXXXXXXXXXX',
    appId: 'X:XXXXXXXXXXXX:web:XXXXXXXXXXXXXXXXXXXXXX',
    measurementId: 'G-XXXXXXXXXX',
  },
};
```

Los valores se obtienen de la consola de Firebase (Project settings > General > Your apps > Web app).

#### Cloud Functions (`functions/src/environments/`)

Archivo excluido del repo vía `functions/.gitignore`:

**`functions/src/environments/environment-functions.ts`**
```ts
export const environments = {
  smtp: {
    host: 'XXXXXXXXXXXXXXXXXXXX',
    port: 465,
    secure: true,
    auth: {
      user: 'XXXXXXXXXXXXXXXXXXXX',
      pass: 'XXXXXXXXXXXXXXXXXXXX',
    },
  },
};
```

**`functions/src/environments/template.html`** — plantilla HTML del correo de invitación (no contiene datos sensibles, pero se incluye en el mismo directorio por organización). Usa `${customLink}` como placeholder del enlace de invitación.

### SMTP y Cloud Functions

Se necesita un **plan de hosting de Firebase (Blaze)** activo para que las Cloud Functions (`sendCustomPasswordResetEmail`) puedan hacer uso del servicio SMTP y enviar correos de recuperación de contraseña. Sin este plan las funciones fallarán al intentar enviar correos.
