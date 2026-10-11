import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const check = () => {
    if (authService.isAuthenticated) {
      if (authService.currentDoctor?.profileComplete === false) {
        router.navigate(['/setup-profile']); return false;
      }
      return true;
    }
    const path = (state.url ?? '').split(/[?#]/)[0];
    const patientPortal = path === '/paciente' || path.startsWith('/paciente/');
    router.navigate([patientPortal ? '/patient-login' : '/login']);
    return false;
  };
  return authService.ready ? authService.ready.then(check) : check();
};
