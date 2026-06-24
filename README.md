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
