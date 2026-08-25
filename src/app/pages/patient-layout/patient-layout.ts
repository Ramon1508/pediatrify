import { Component, ChangeDetectionStrategy } from '@angular/core';
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
export class PatientLayout {}
