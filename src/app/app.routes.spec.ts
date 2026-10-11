import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';

@Component({ template: '<router-outlet />', imports: [RouterOutlet] })
class StaffLayoutStub {}
@Component({ template: '<p>Directorio de doctores</p>' })
class DoctorsStub {}
@Component({ template: '<p>Calendario</p>' })
class CalendarStub {}
@Component({ template: '<p>Iniciar sesión</p>' })
class LoginStub {}
@Component({ template: '<p>Perfil de Paciente</p>' })
class PatientProfileStub {}
@Component({ template: '<p>Acceso paciente</p>' })
class PatientLoginStub {}
@Component({ template: '<p>Bitácora</p>' })
class AuditLogStub {}

// Exercise real route redirects and guards while replacing feature rendering only.
const testRoutes: Routes = routes.map(route => {
  if (route.path === 'login') return { ...route, loadComponent: () => Promise.resolve(LoginStub) };
  if (route.path === 'patient-login') return { ...route, loadComponent: () => Promise.resolve(PatientLoginStub) };
  if (route.path === 'paciente') return { ...route, loadComponent: () => Promise.resolve(StaffLayoutStub), children: route.children?.map(child => {
    if (child.path === 'perfil') return { ...child, loadComponent: () => Promise.resolve(PatientProfileStub) };
    return child;
  }) };
  if (route.path !== 'app') return route;
  return { ...route, loadComponent: () => Promise.resolve(StaffLayoutStub), children: route.children?.map(child => {
    if (child.path === 'doctors') return { ...child, loadComponent: () => Promise.resolve(DoctorsStub) };
    if (child.path === 'admins') return { ...child, loadComponent: () => Promise.resolve(DoctorsStub) };
    if (child.path === 'calendar') return { ...child, loadComponent: () => Promise.resolve(CalendarStub) };
    if (child.path === 'audit-log') return { ...child, loadComponent: () => Promise.resolve(AuditLogStub) };
    return child;
  }) };
});

describe('Staff entry routes (P14)', () => {
  async function setup(role: string | null) {
    const state = { role };
    const auth = {
      get currentDoctor() { return ['admin', 'doctor', 'assistant'].includes(state.role ?? '')
        ? { uid: 'synthetic-user', role: state.role, profileComplete: true } : null; },
      get isAuthenticated() { return state.role !== null; },
      get isDoctor() { return !!this.currentDoctor; },
      get isPatient() { return state.role === 'patient'; },
      hasAnyRole: (allowed: string[]) => allowed.includes(state.role ?? ''),
    };
    TestBed.configureTestingModule({ providers: [provideRouter(testRoutes), { provide: AuthService, useValue: auth }] });
    const harness = await RouterTestingHarness.create();
    return { harness, state, router: TestBed.inject(Router) };
  }

  it.each([
    ['admin', '/app/doctors', 'Directorio de doctores'],
    ['doctor', '/app/calendar', 'Calendario'],
    ['assistant', '/app/calendar', 'Calendario'],
  ])('opening /app as %s reaches its authorized initial screen', async (role, destination, content) => {
    const { harness, router } = await setup(role);
    await harness.navigateByUrl('/app');
    expect(router.url).toBe(destination);
    expect(harness.routeNativeElement?.textContent).toContain(content);
  });

  it('reads the current role again when another staff session enters /app', async () => {
    const { harness, router, state } = await setup('admin');
    await harness.navigateByUrl('/app');
    expect(router.url).toBe('/app/doctors');
    state.role = 'assistant';
    await harness.navigateByUrl('/app');
    expect(router.url).toBe('/app/calendar');
    state.role = 'admin';
    await harness.navigateByUrl('/app');
    expect(router.url).toBe('/app/doctors');
  });

  it.each([null, 'patient', 'unknown'])('session %s cannot enter the staff root', async role => {
    const { harness, router } = await setup(role);
    await harness.navigateByUrl('/app');
    await vi.waitFor(() => expect(router.url).toBe('/login'));
    expect(harness.routeNativeElement?.textContent).not.toContain('Directorio de doctores');
    expect(harness.routeNativeElement?.textContent).not.toContain('Calendario');
  });

  it.each([
    ['admin', '/app/calendar'],
    ['assistant', '/app/doctors'],
  ])('redirect does not grant %s access to %s', async (role, path) => {
    const { harness, router } = await setup(role);
    await harness.navigateByUrl(path);
    await vi.waitFor(() => expect(router.url).toBe('/login'));
  });

  it('allows the patient to open its own profile without entering the staff portal (P15)', async () => {
    const { harness, router } = await setup('patient');
    await harness.navigateByUrl('/paciente/perfil');
    expect(router.url).toBe('/paciente/perfil');
    expect(harness.routeNativeElement?.textContent).toContain('Perfil de Paciente');
  });

  it.each([null, 'doctor', 'assistant'])('session %s cannot open the patient profile (P15)', async role => {
    const { harness, router } = await setup(role);
    await harness.navigateByUrl('/paciente/perfil');
    await vi.waitFor(() => expect(router.url).toBe(role === null ? '/patient-login' : '/app/calendar'));
    expect(harness.routeNativeElement?.textContent).not.toContain('Perfil de Paciente');
  });

  it('allows the admin to open the audit log (P44)', async () => {
    const { harness, router } = await setup('admin');
    await harness.navigateByUrl('/app/audit-log');
    expect(router.url).toBe('/app/audit-log');
    expect(harness.routeNativeElement?.textContent).toContain('Bitácora');
  });

  it.each(['doctor', 'assistant'])('session %s cannot open the admin audit log (P44)', async role => {
    const { harness, router } = await setup(role);
    await harness.navigateByUrl('/app/audit-log');
    await vi.waitFor(() => expect(router.url).toBe('/login'));
  });

  it('allows the admin to open the admins directory (P45)', async () => {
    const { harness, router } = await setup('admin');
    await harness.navigateByUrl('/app/admins');
    expect(router.url).toBe('/app/admins');
    expect(harness.routeNativeElement?.textContent).toContain('Directorio de doctores');
  });

  it.each(['doctor', 'assistant'])('session %s cannot open the admins directory (P45)', async role => {
    const { harness, router } = await setup(role);
    await harness.navigateByUrl('/app/admins');
    await vi.waitFor(() => expect(router.url).toBe('/login'));
  });
});
