import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Appointment } from '../../../core/models/user';

@Component({
  selector: 'app-appointment-detail-card',
  templateUrl: './appointment-detail-card.html',
  styleUrl: './appointment-detail-card.scss',
  standalone: true,
  imports: [MatButtonModule],
})
export class AppointmentDetailCard {
  readonly appointment = input.required<Appointment>();
  readonly close = output<void>();

  onReagendar() {
    console.log('Reagendar');
  }

  onCancelar() {
    this.close.emit();
  }

  onVerHistorial() {
    console.log('Ver historial');
  }
}
