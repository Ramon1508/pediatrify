import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
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
  @Input({ required: true }) patient!: Patient & { ageDisplay: string };
  @Input({ required: true }) isAdmin!: boolean;

  @Output() edit = new EventEmitter<Patient>();
  @Output() completeProfile = new EventEmitter<Patient>();
  @Output() viewHistory = new EventEmitter<Patient>();
  @Output() setCustomOtp = new EventEmitter<Patient>();
  @Output() regenerateOtp = new EventEmitter<Patient>();
  @Output() delete = new EventEmitter<Patient>();
}
