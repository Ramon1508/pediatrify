import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { patientGuard } from './core/guards/patient.guard';

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
    path: 'patient-login',
    loadComponent: () => import('./pages/otp-login/otp-login').then((m) => m.OtpLogin),
  },
  {
    path: 'auth-handler',
    loadComponent: () =>
      import('./pages/auth-handler/auth-handler').then((m) => m.AuthHandlerComponent),
  },
  {
    path: 'setup-profile',
    loadComponent: () => import('./pages/setup-profile/setup-profile').then((m) => m.SetupProfile),
  },
  {
    path: 'app/secret/housekeeping/initialize_if_errors/approve',
    loadComponent: () =>
      import('./pages/housekeeping/admin-initialize/admin-initialize').then(
        (m) => m.AdminInitialize,
      ),
  },
  {
    path: 'app',
    loadComponent: () => import('./pages/doctor-layout/doctor-layout').then((m) => m.DoctorLayout),
    canActivate: [authGuard, roleGuard(['admin', 'doctor', 'assistant'])],
    children: [
      { path: '', redirectTo: 'calendar', pathMatch: 'full' },
      {
        path: 'calendar',
        loadComponent: () => import('./pages/calendar/calendar').then((m) => m.Calendar),
        canActivate: [roleGuard(['doctor', 'assistant'])],
      },
      {
        path: 'patients',
        loadComponent: () => import('./pages/patients/patients').then((m) => m.Patients),
        canActivate: [roleGuard(['doctor'])],
      },
      {
        path: 'patients/history/:patientId',
        loadComponent: () =>
          import('./pages/patient-history/patient-history').then((m) => m.PatientHistory),
        canActivate: [roleGuard(['doctor'])],
      },
      {
        path: 'doctors',
        loadComponent: () => import('./pages/doctors/doctors').then((m) => m.Doctors),
        canActivate: [roleGuard(['admin', 'doctor'])],
      },
      {
        path: 'impresion',
        loadComponent: () => import('./pages/impresion/impresion').then((m) => m.Impresion),
        canActivate: [roleGuard(['doctor'])],
      },
    ],
  },
  {
    path: 'paciente',
    loadComponent: () =>
      import('./pages/patient-layout/patient-layout').then((m) => m.PatientLayout),
    canActivate: [authGuard, patientGuard],
    children: [
      { path: '', redirectTo: 'calendario', pathMatch: 'full' },
      {
        path: 'calendario',
        loadComponent: () => import('./pages/calendar/calendar').then((m) => m.Calendar),
      },
      {
        path: 'pacientes',
        loadComponent: () =>
          import('./pages/patient-patients/patient-patients').then((m) => m.PatientPatients),
      },
      {
        path: 'pacientes/history/:patientId',
        loadComponent: () =>
          import('./pages/patient-history-view/patient-history-view').then(
            (m) => m.PatientHistoryView,
          ),
      },
    ],
  },
  {
    path: 'print/:recordId',
    loadComponent: () => import('./pages/print-preview/print-preview').then((m) => m.PrintPreview),
    canActivate: [authGuard],
  },
  { path: 'dashboard', redirectTo: '/app/calendar', pathMatch: 'full' },
  { path: 'appointments', redirectTo: '/app/calendar', pathMatch: 'full' },
  { path: 'patients', redirectTo: '/app/patients', pathMatch: 'full' },
  { path: 'doctors', redirectTo: '/app/doctors', pathMatch: 'full' },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
