import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const profileGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isDoctor) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.currentDoctor?.profileComplete) {
    router.navigate(['/app/calendar']);
    return false;
  }

  return true;
};
