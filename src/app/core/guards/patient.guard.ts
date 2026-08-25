import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const patientGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isPatient) return true;

  // Un doctor (o un visitante sin sesión de paciente) no puede entrar al portal del paciente.
  router.navigate(authService.isDoctor ? ['/app/calendar'] : ['/login']);
  return false;
};
