import { Component, computed, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { BRAND_NAME, DEFAULT_LOGO_URL } from '../../../core/config/brand';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { UserRepository } from '../../../core/repositories/user.repository';
import { SessionUser } from '../../../core/models/user';
import { resolveLogoUrl } from '../../../core/utils/logo-utils';
import { ProfileDialog } from '../profile-dialog/profile-dialog';
import { PatientProfile } from '../patient-profile/patient-profile';
import { NotificationBell } from '../notification-bell/notification-bell';
import { from, filter, map, switchMap, catchError, of, startWith } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    NotificationBell,
    RouterLink,
  ],
})
export class Header {
  protected authService = inject(AuthService);
  protected readonly brandName = signal(inject(BRAND_NAME));
  protected readonly logoAlt = computed(() => `Logo de ${this.brandName()}`);
  private readonly session = toSignal(this.authService.session$, { initialValue: this.authService.session });
  protected readonly isAuthenticated = computed(() => !!this.session());
  private readonly destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private location = inject(Location);
  private firebase = inject(FirebaseService);
  private userRepo = inject(UserRepository);
  private defaultLogo = inject(DEFAULT_LOGO_URL);
  private logoRevision = 0;

  protected profileActive = signal(false);
  private profileDialogOpen = false;

  private readonly mobileQuery = '(max-width: 768px)';

  constructor() {
    if (this.router.events) {
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.syncProfileActive());
    }
    this.syncProfileActive();
  }

  private get isMobile(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(this.mobileQuery).matches
    );
  }

  private syncProfileActive() {
    this.profileActive.set(this.onProfileRoute() || this.profileDialogOpen);
  }

  private onProfileRoute(): boolean {
    const path = (this.router.url ?? '').split(/[?#]/)[0];
    return path === '/app/perfil' || path === '/paciente/perfil';
  }


  protected readonly homeRoute = toSignal(
    this.authService.session$.pipe(map((session) => {
      if (session?.type === 'doctor') {
        return session.user.role === 'admin' ? '/app/doctors' : '/app/calendar';
      }
      return session?.type === 'patient' ? '/paciente/calendario' : '/login';
    })),
    { initialValue: '/login' },
  );

  protected logoUrl = toSignal(
    this.authService.session$.pipe(
      switchMap((session) => from(this.resolveHeaderLogo(session)).pipe(
        catchError(() => of(this.defaultLogo)),
        startWith(this.defaultLogo),
      ))
    ),
    { initialValue: this.defaultLogo }
  );

  /** P33: Asistente/Paciente heredan el logo del Doctor propietario. */
  private async resolveHeaderLogo(session: SessionUser): Promise<string> {
    const logoPath = await this.ownerLogoPath(session);
    return logoPath ? this.resolveSessionLogo(logoPath) : this.defaultLogo;
  }

  private async ownerLogoPath(session: SessionUser): Promise<string> {
    if (!session) return '';
    if (session.type === 'doctor') {
      const user = session.user;
      if (user.role === 'doctor') return user.logoPath ?? '';
      if (user.role === 'assistant' && user.createdBy) {
        const owner = await this.userRepo.getUser(user.createdBy);
        return owner?.logoPath ?? '';
      }
      return '';
    }
    const doctorId = session.patient.doctorId;
    if (!doctorId) return '';
    const owner = await this.userRepo.getUser(doctorId);
    return owner?.logoPath ?? '';
  }

  private async resolveSessionLogo(logoPath: string): Promise<string> {
    const url = await resolveLogoUrl(this.firebase.storage, logoPath);
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${++this.logoRevision}`;
  }

  protected openProfileDialog() {
    const session = this.session();
    if (!session || this.profileDialogOpen) return;
    if (this.isMobile) {
      if (this.onProfileRoute()) {
        if (session.type === 'patient') this.router.navigate(['/paciente/calendario']);
        else this.location.back();
      } else {
        this.router.navigate([session.type === 'patient' ? '/paciente/perfil' : '/app/perfil']);
      }
      return;
    }
    this.profileDialogOpen = true;
    this.profileActive.set(true);
    const config = {
      panelClass: 'profile-panel',
      backdropClass: 'profile-backdrop',
      disableClose: false,
    };
    const ref = session.type === 'patient'
      ? this.dialog.open(PatientProfile, config)
      : this.dialog.open(ProfileDialog, config);
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.profileDialogOpen = false;
      this.syncProfileActive();
    });
  }
}
