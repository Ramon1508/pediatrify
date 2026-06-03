import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { profileGuard } from './profile.guard';
import { AuthService } from '../services/auth.service';

describe('profileGuard', () => {
  let isDoctor = false;
  let profileComplete = false;

  function runGuard() {
    return TestBed.runInInjectionContext(() => profileGuard({} as any, {} as any));
  }

  function getDoctor() {
    return isDoctor ? { profileComplete } : null;
  }

  beforeEach(() => {
    isDoctor = false;
    profileComplete = false;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            get isDoctor() { return isDoctor; },
            get currentDoctor() { return getDoctor(); },
          } as any,
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
  });

  it('allows access when doctor has incomplete profile', () => {
    isDoctor = true;
    profileComplete = false;
    expect(runGuard()).toBe(true);
  });

  it('redirects to /app/calendar when profile is complete', () => {
    isDoctor = true;
    profileComplete = true;
    const router = TestBed.inject(Router);
    expect(runGuard()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/app/calendar']);
  });

  it('redirects to /login when user is not a doctor', () => {
    isDoctor = false;
    const router = TestBed.inject(Router);
    expect(runGuard()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
