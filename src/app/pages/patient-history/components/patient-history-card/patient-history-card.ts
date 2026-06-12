import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Patient } from '../../../../core/models/user';

@Component({
  selector: 'app-patient-history-card',
  templateUrl: './patient-history-card.html',
  styleUrl: './patient-history-card.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
})
export class PatientHistoryCard {
  @Input({ required: true }) patient!: Patient & { ageDisplay: string };

  @Output() completeProfile = new EventEmitter<Patient>();
  @Output() viewProfile = new EventEmitter<Patient>();
  @Output() editProfile = new EventEmitter<Patient>();
  @Output() delete = new EventEmitter<Patient>();
}
