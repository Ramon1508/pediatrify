import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { UserRepository } from '../../core/repositories/user.repository';
import { AppUser } from '../../core/models/user';
import { AlertService } from '../../core/services/alert.service';
import { InviteDoctorDialog } from './dialogs/invite-doctor-dialog/invite-doctor-dialog';
import { EditDoctorDialog } from './dialogs/edit-doctor-dialog/edit-doctor-dialog';
import { DeleteDoctorDialog } from './dialogs/delete-doctor-dialog/delete-doctor-dialog';

@Component({
  selector: 'app-doctors',
  templateUrl: './doctors.html',
  styleUrl: './doctors.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
  ],
})
export class Doctors implements OnInit, OnDestroy {
  private userRepo = inject(UserRepository);
  private alert = inject(AlertService);
  private dialog = inject(MatDialog);

  protected doctors = signal<AppUser[]>([]);
  protected loading = signal(true);
  protected searchControl = new FormControl('');
  protected searchTerm = signal('');

  protected filteredDoctors = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.doctors();
    return this.doctors().filter(
      (d) => d.name.toLowerCase().includes(term)
    );
  });

  private subs: any[] = [];

  async ngOnInit() {
    this.subs.push(
      this.searchControl.valueChanges.subscribe((val) => {
        this.searchTerm.set(val || '');
      })
    );
    this.userRepo.watchAllUsers().subscribe((users) => {
      this.doctors.set(users.filter(u => u.role === 'assistant'));
      this.loading.set(false);
    });
  }

  ngOnDestroy() {
    for (const s of this.subs) s.unsubscribe();
  }

  openNewDoctor() {
    this.dialog.open(InviteDoctorDialog, {
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    });
  }

  openEditDoctor(doctor: AppUser) {
    const dialogRef = this.dialog.open(EditDoctorDialog, {
      width: '400px',
      disableClose: true,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setDoctor(doctor);
  }

  resendInvitation(doctor: AppUser) {
    const origin = window.location.origin;
    const link = `${origin}/setup-profile?email=${encodeURIComponent(doctor.email)}`;
    navigator.clipboard.writeText(link);
    this.alert.success({ message: `Enlace de invitación copiado para ${doctor.name}`, duration: 3000 });
  }

  deleteDoctor(doctor: AppUser) {
    const dialogRef = this.dialog.open(DeleteDoctorDialog, {
      width: '400px',
      disableClose: true,
    });
    dialogRef.componentInstance.setDoctor(doctor);
  }
}
