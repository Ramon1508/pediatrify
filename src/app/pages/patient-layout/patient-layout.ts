import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Header } from '../../shared/components/header/header';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-patient-layout',
  templateUrl: './patient-layout.html',
  styleUrl: './patient-layout.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Header, MatIconModule],
})
export class PatientLayout implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private sessionSubscription?: Subscription;

  ngOnInit() {
    this.sessionSubscription = this.auth.session$.subscribe(session => {
      if (session?.type !== 'patient') this.dialog.closeAll();
    });
    // Modales a pantalla completa en mobile: dejan libre el header (arriba) y la barra de
    // navegación inferior (el portal del paciente siempre la tiene).
    document.body.style.setProperty('--app-header-h', '56px');
    document.body.style.setProperty('--app-nav-h', '64px');
  }

  ngOnDestroy() {
    this.sessionSubscription?.unsubscribe();
    document.body.style.removeProperty('--app-nav-h');
  }
}
