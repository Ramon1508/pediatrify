import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Header } from '../../shared/components/header/header';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-patient-layout',
  templateUrl: './patient-layout.html',
  styleUrl: './patient-layout.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Header, MatIconModule],
})
export class PatientLayout implements OnInit, OnDestroy {
  ngOnInit() {
    // Modales a pantalla completa en mobile: dejan libre el header (arriba) y la barra de
    // navegación inferior (el portal del paciente siempre la tiene).
    document.body.style.setProperty('--app-header-h', '56px');
    document.body.style.setProperty('--app-nav-h', '64px');
  }

  ngOnDestroy() {
    document.body.style.removeProperty('--app-nav-h');
  }
}
