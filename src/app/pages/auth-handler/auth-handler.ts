import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { checkActionCode, applyActionCode } from 'firebase/auth'; // Importado del SDK oficial
import { FirebaseService } from '../../core/firebase/firebase.service';

@Component({
  selector: 'app-auth-handler',
  standalone: true,
  template: '<p>Procesando tu verificación de cuenta...</p>'
})
export class AuthHandlerComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firebaseService: FirebaseService // Inyectamos tu servicio personalizado
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(async params => {
      const oobCode = params['oobCode'];
      const mode = params['mode'];

      if (mode === 'verifyEmail' && oobCode) {
        try {
          const auth = this.firebaseService.auth; // Obtenemos la instancia de Auth de tu servicio

          // 1. Extraemos el email correspondiente al código de verificación
          const info = await checkActionCode(auth, oobCode);
          const email = info.data.email;

          // 2. Aplicamos la verificación en Firebase Auth
          await applyActionCode(auth, oobCode);

          // 3. Redirigimos al usuario a su ruta de completar perfil (ej: /ejemplo@correo.com)
          if (email) {
            this.router.navigateByUrl(`/setup-profile?email=${email}`); // Navega a /ejemplo@correo.com
          } else {
            this.router.navigate(['/']);
          }
        } catch (error) {
          console.error("Error al verificar la cuenta:", error);
          this.router.navigate(['/error']); // Ruta alternativa en caso de link expirado o inválido
        }
      }
    });
  }
}
