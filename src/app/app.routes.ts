import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'pacientes',
    loadComponent: () => import('./pages/otp-login/otp-login').then((m) => m.OtpLogin),
  },
  {
    path: 'setup-profile',
    loadComponent: () =>
      import('./pages/setup-profile/setup-profile').then((m) => m.SetupProfile),
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./pages/doctor-layout/doctor-layout').then((m) => m.DoctorLayout),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'calendar', pathMatch: 'full' },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./pages/calendar/calendar').then((m) => m.Calendar),
        canActivate: [roleGuard(['admin', 'employee'])],
      },
      {
        path: 'patients',
        loadComponent: () => import('./pages/patients/patients').then((m) => m.Patients),
        canActivate: [roleGuard(['admin', 'employee'])],
      },
      {
        path: 'patients/history/:patientId',
        loadComponent: () => import('./pages/patient-history/patient-history').then((m) => m.PatientHistory),
        canActivate: [roleGuard(['admin', 'employee'])],
      },
      {
        path: 'doctors',
        loadComponent: () => import('./pages/doctors/doctors').then((m) => m.Doctors),
        canActivate: [roleGuard(['admin'])],
      },
      {
        path: 'impresion',
        loadComponent: () => import('./pages/impresion/impresion').then((m) => m.Impresion),
        canActivate: [roleGuard(['admin'])],
      },
      {
        path: 'audit-log',
        loadComponent: () => import('./pages/audit-log/audit-log').then((m) => m.AuditLog),
        canActivate: [roleGuard(['admin'])],
      },
    ],
  },
  {
    path: 'otp-dashboard',
    loadComponent: () =>
      import('./pages/otp-dashboard/otp-dashboard').then((m) => m.OtpDashboard),
    canActivate: [authGuard],
  },
  { path: 'dashboard', redirectTo: '/app/calendar', pathMatch: 'full' },
  { path: 'appointments', redirectTo: '/app/calendar', pathMatch: 'full' },
  { path: 'patients', redirectTo: '/app/patients', pathMatch: 'full' },
  { path: 'doctors', redirectTo: '/app/doctors', pathMatch: 'full' },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
