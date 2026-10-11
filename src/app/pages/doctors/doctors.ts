import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
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
import { AuthService } from '../../core/services/auth.service';
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
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private readonly currentUser = toSignal(this.authService.session$.pipe(map(() => this.authService.currentDoctor)),
    { initialValue: this.authService.currentDoctor });

  /** P45: 'admin' cuando la ruta es el directorio de Administradores. */
  private readonly directory = signal(this.route.snapshot.data['directory'] as 'admin' | undefined);

  private readonly users = signal<AppUser[]>([]);
  protected readonly doctors = computed(() => {
    const current = this.currentUser();
    if (this.isAdminDirectory()) return current?.role === 'admin' ? this.users().filter(u => u.role === 'admin') : [];
    return current?.role === 'admin' ? this.users().filter(u => u.role === 'doctor') : current?.role === 'doctor'
      ? this.users().filter(u => u.role === 'assistant' && u.createdBy === current.uid) : [];
  });
  protected loading = signal(true);
  protected readonly searchForm = inject(FormBuilder).group({ search: [''] });
  protected readonly searchControl = this.searchForm.controls.search;
  protected searchTerm = signal('');

  protected readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  protected readonly isAdminDirectory = computed(() => this.directory() === 'admin');
  protected readonly pageTitle = computed(() => this.isAdminDirectory() ? 'Administradores' : this.isAdmin() ? 'Doctores' : 'Asistentes');
  protected readonly addLabel = computed(() => this.isAdminDirectory() ? 'Agregar administrador' : this.isAdmin() ? 'Agregar doctor' : 'Agregar asistente');
  protected readonly emptyLabel = computed(() => this.isAdminDirectory() ? 'No has agregado ningún administrador'
    : this.isAdmin() ? 'No has agregado ningún doctor' : 'No has agregado ningún asistente');
  protected readonly editLabel = computed(() => this.isAdminDirectory() ? 'Editar administrador' : this.isAdmin() ? 'Editar doctor' : 'Editar asistente');
  protected readonly deleteLabel = computed(() => this.isAdminDirectory() ? 'Eliminar administrador' : this.isAdmin() ? 'Eliminar doctor' : 'Eliminar asistente');
  protected readonly directoryRows = computed(() => this.filteredDoctors().map(user => ({ user,
    ownAdmin: this.isAdminDirectory() && user.uid === this.currentUser()?.uid,
  })));

  protected filteredDoctors = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.doctors();
    return this.doctors().filter(
      (d) => d.name.toLowerCase().includes(term)
    );
  });

  private subs: any[] = [];

  async ngOnInit() {
    if (!this.canOpenDirectory()) { this.loading.set(false); return; }
    this.subs.push(
      this.searchControl.valueChanges.subscribe((val) => {
        this.searchTerm.set(val || '');
      })
    );
    this.subs.push(this.userRepo.watchAllUsers().subscribe((users) => {
      this.users.set(users);
      this.loading.set(false);
    }));
  }

  ngOnDestroy() {
    for (const s of this.subs) s.unsubscribe();
  }

  openNewDoctor() {
    if (!this.canOpenDirectory()) return;
    const dialogRef = this.dialog.open(InviteDoctorDialog, {
      width: '400px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    if (this.isAdminDirectory()) dialogRef.componentInstance.setTargetRole('admin');
  }

  openEditDoctor(doctor: AppUser) {
    if (!this.canManageTarget(doctor) || doctor.uid === this.authService.currentDoctor?.uid) return;
    const dialogRef = this.dialog.open(EditDoctorDialog, {
      width: '400px',
      disableClose: false,
      panelClass: 'right-panel',
    });
    dialogRef.componentInstance.setDoctor(doctor);
  }

  resendInvitation(doctor: AppUser) {
    if (doctor.pending !== true || !this.canManageTarget(doctor)) return;
    const ref = this.dialog.open(InviteDoctorDialog, { width: '400px', disableClose: false, panelClass: 'right-panel' });
    ref.componentInstance.setResendTarget(doctor);
  }

  deleteDoctor(doctor: AppUser) {
    if (!this.canManageTarget(doctor)) return;
    if (this.isAdminDirectory()) {
      if (doctor.uid === this.authService.currentDoctor?.uid) {
        this.alert.error({ message: 'No puedes eliminar tu propia cuenta de administrador.', duration: 5000 });
        return;
      }
      if (this.doctors().filter((d) => d.role === 'admin').length <= 1) {
        this.alert.error({ message: 'Debe existir al menos un administrador.', duration: 5000 });
        return;
      }
    }
    const dialogRef = this.dialog.open(DeleteDoctorDialog, {
      width: '552px',
      disableClose: false,
      panelClass: 'context-card-panel',
    });
    dialogRef.componentInstance.setDoctor(doctor);
  }

  private canOpenDirectory(): boolean {
    const role = this.authService.currentDoctor?.role;
    return this.isAdminDirectory() ? role === 'admin' : role === 'admin' || role === 'doctor';
  }

  private canManageTarget(target: AppUser): boolean {
    const actor = this.authService.currentDoctor;
    return this.canOpenDirectory() && !!actor && (this.isAdminDirectory() ? target.role === 'admin' :
      actor.role === 'admin' ? target.role === 'doctor' : target.role === 'assistant' && target.createdBy === actor.uid);
  }
}
