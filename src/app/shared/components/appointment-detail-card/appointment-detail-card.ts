import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Appointment } from '../../../core/models/user';

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
  readonly edit = output<Appointment>();
  readonly cancel = output<void>();

  onReagendar() {
    this.edit.emit(this.appointment());
  }

  onCancelar() {
    this.cancel.emit();
  }

  onVerHistorial() {
    console.log('Ver historial');
  }
}
