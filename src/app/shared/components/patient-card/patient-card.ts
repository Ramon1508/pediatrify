import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Patient } from '../../../core/models/user';

@Component({
  selector: 'app-patient-card',
  templateUrl: './patient-card.html',
  styleUrl: './patient-card.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
})
export class PatientCard {
  readonly patient = input.required<Patient & { ageDisplay: string }>();

  readonly edit = output<Patient>();
  readonly completeProfile = output<Patient>();
  readonly viewHistory = output<Patient>();
  readonly viewAccess = output<Patient>();
  readonly regenerateOtp = output<Patient>();
  readonly delete = output<Patient>();
}
