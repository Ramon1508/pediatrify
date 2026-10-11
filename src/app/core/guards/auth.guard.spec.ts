import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let isAuthenticated = false;

  function runGuard(url = '/app/calendar') {
    return TestBed.runInInjectionContext(() => authGuard({} as any, { url } as any));
  }

  beforeEach(() => {
    isAuthenticated = false;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            get isAuthenticated() { return isAuthenticated; },
          } as any,
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
  });

  it('returns true if authenticated', () => {
    isAuthenticated = true;
    expect(runGuard()).toBe(true);
  });

  it('returns false and redirects to /login if not authenticated', () => {
    const router = TestBed.inject(Router);
    expect(runGuard()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it.each(['/paciente', '/paciente/perfil', '/paciente/pacientes/history/synthetic?test=true'])('requires patient login for %s without an active session', url => {
    expect(runGuard(url)).toBe(false);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/patient-login']);
  });

  it('does not treat another path with the same prefix as the patient portal', () => {
    expect(runGuard('/pacientes-other')).toBe(false);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
  });
});
