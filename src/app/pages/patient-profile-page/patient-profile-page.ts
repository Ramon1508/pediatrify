import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PatientProfile } from '../../shared/components/patient-profile/patient-profile';

@Component({
  selector: 'app-patient-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PatientProfile],
  template: `<app-patient-profile [asPage]="true" />`,
  styles: [`:host { display: block; min-height: 100%; background: #ffffff; }`],
})
export class PatientProfilePage {}
