import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const check = () => {
      if (authService.isDoctor && authService.hasAnyRole(allowedRoles)) return true;
      router.navigate(['/login']); return false;
    };
    return authService.ready ? authService.ready.then(check) : check();
  };
};
