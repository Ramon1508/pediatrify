import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Appointment } from '../../../core/models/user';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-appointment-detail-card',
  templateUrl: './appointment-detail-card.html',
  styleUrl: './appointment-detail-card.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
})
export class AppointmentDetailCard {
  readonly appointment = input.required<Appointment>();
  readonly allowPatientScheduling = input(false);
  readonly edit = output<Appointment>();
  readonly cancel = output<void>();

  private authService = inject(AuthService);
  private router = inject(Router);

  protected get isAssistant(): boolean {
    return this.authService.currentDoctor?.role === 'assistant';
  }

  protected get isPatient(): boolean {
    return this.authService.isPatient;
  }

  onReagendar() {
    this.edit.emit(this.appointment());
  }

  onCancelar() {
    this.cancel.emit();
  }

  onVerHistorial() {
    const patientId = this.appointment().patientId;
    if (this.isPatient) {
      this.router.navigate(['/paciente/pacientes/history', patientId]);
    } else {
      this.router.navigate(['/app/patients/history', patientId]);
    }
  }
}
