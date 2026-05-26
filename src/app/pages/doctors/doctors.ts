import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Timestamp } from 'firebase/firestore';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Clipboard } from '@angular/cdk/clipboard';
import { setDoc, doc } from 'firebase/firestore';
import { UserRepository } from '../../core/repositories/user.repository';
import { FirebaseService } from '../../core/firebase/firebase.service';
import { AppUser } from '../../core/models/user';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-doctors',
  templateUrl: './doctors.html',
  styleUrl: './doctors.scss',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
  ],
})
export class Doctors implements OnInit {
  private userRepo = inject(UserRepository);
  private firebase = inject(FirebaseService);
  private alert = inject(AlertService);
  private clipboard = inject(Clipboard);

  protected doctors = signal<AppUser[]>([]);
  protected loading = true;
  protected displayedColumns = ['name', 'email', 'role', 'status', 'actions'];

  protected showDialog = false;
  protected saving = false;
  protected dialogError = '';
  protected invitationLink = '';
  protected form = { name: '', email: '', role: 'employee' as const };

  async ngOnInit() {
    this.userRepo.watchAllUsers().subscribe((users) => {
      this.doctors.set(users);
      this.loading = false;
    });
  }

  openNewDoctor() {
    this.form = { name: '', email: '', role: 'employee' };
    this.dialogError = '';
    this.invitationLink = '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
    this.invitationLink = '';
  }

  async saveDoctor() {
    if (!this.form.name || !this.form.email) return;

    this.saving = true;
    this.dialogError = '';

    try {
      const uid = crypto.randomUUID();

      await setDoc(doc(this.firebase.firestore, 'users', uid), {
        uid,
        email: this.form.email,
        name: this.form.name,
        role: this.form.role,
        pending: true,
        createdAt: Timestamp.now(),
      });

      const origin = window.location.origin;
      this.invitationLink = `${origin}/setup-profile?email=${encodeURIComponent(this.form.email)}`;
      this.alert.success({ message: `Invitación creada para ${this.form.name}`, duration: 3000 });
    } catch (e: any) {
      this.dialogError = e.message || 'Error al crear invitación';
    } finally {
      this.saving = false;
    }
  }

  copyLink() {
    this.clipboard.copy(this.invitationLink);
    this.alert.success({ message: 'Enlace copiado al portapapeles', duration: 2000 });
  }

  async deleteDoctor(doctor: AppUser) {
    if (!confirm(`¿Eliminar a ${doctor.name}?`)) return;
    try {
      await this.userRepo.deleteUser(doctor.uid);
      this.alert.success({ message: 'Doctor eliminado', duration: 3000 });
    } catch (e: any) {
      this.alert.error({ message: 'Error al eliminar doctor' });
    }
  }
}
