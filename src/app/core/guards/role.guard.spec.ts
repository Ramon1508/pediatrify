import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user';

describe('roleGuard', () => {
  let isDoctor = false;
  let hasRole = false;

  function runGuard(allowedRoles: UserRole[]) {
    return TestBed.runInInjectionContext(() => roleGuard(allowedRoles)({} as any, {} as any));
  }

  beforeEach(() => {
    isDoctor = false;
    hasRole = false;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            get isDoctor() { return isDoctor; },
            hasAnyRole: vi.fn(() => hasRole),
          } as any,
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
  });

  it('allows access when doctor has allowed role', () => {
    isDoctor = true;
    hasRole = true;
    expect(runGuard(['admin' as UserRole])).toBe(true);
  });

  it('denies access when doctor lacks allowed role', () => {
    isDoctor = true;
    hasRole = false;
    const router = TestBed.inject(Router);
    expect(runGuard(['admin' as UserRole])).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('denies access when user is not a doctor', () => {
    isDoctor = false;
    hasRole = false;
    const router = TestBed.inject(Router);
    expect(runGuard(['admin' as UserRole])).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
