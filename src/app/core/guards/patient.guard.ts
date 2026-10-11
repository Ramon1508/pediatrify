import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const patientGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const check = () => {
    if (authService.isPatient) return true;
    router.navigate(authService.isDoctor ? ['/app'] : ['/patient-login']); return false;
  };
  return authService.ready ? authService.ready.then(check) : check();
};
