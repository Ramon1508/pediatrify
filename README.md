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

Las credenciales están en `src/environments/environment.ts` (excluido del repo vía `.gitignore`).
