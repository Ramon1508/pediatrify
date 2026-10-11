import { Component, input, output, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Appointment } from '../../../core/models/user';
import { ClinicClockService } from '../../../core/services/clinic-clock.service';

function calcAge(birthDate: unknown): string {
  let d: Date | null = null;
  if (typeof birthDate === 'string') {
    const parts = birthDate.split('-');
    if (parts.length === 3) d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  } else if (birthDate && typeof (birthDate as any).toDate === 'function') {
    d = (birthDate as any).toDate();
  }
  if (!d || isNaN(d.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12;
  months += now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) return '0 meses';
  if (months < 24) return `${months} meses`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths > 0
    ? `${years} años ${remainingMonths} meses`
    : `${years} años`;
}

@Component({
  selector: 'app-appointment-card',
  templateUrl: './appointment-card.html',
  styleUrl: './appointment-card.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatTooltipModule],
})
export class AppointmentCard {
  private readonly clock = inject(ClinicClockService);
  readonly appointment = input.required<Appointment>();
  readonly cancel = output<Appointment>();
  readonly viewHistory = output<Appointment>();

  readonly ageDisplay = computed(() => {
    this.clock.now();
    return calcAge(this.appointment().patientBirthDate);
  });
}
