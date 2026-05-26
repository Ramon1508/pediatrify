import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Header } from '../../shared/components/header/header';
import { Sidebar } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-doctor-layout',
  templateUrl: './doctor-layout.html',
  styleUrl: './doctor-layout.scss',
  standalone: true,
  imports: [
    RouterOutlet,
    MatSidenavModule,
    Header,
    Sidebar,
  ],
})
export class DoctorLayout implements OnInit, OnDestroy {
  private breakpointObserver = inject(BreakpointObserver);

  protected sidenavOpened = signal(true);
  protected isMobile = signal(false);
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.isMobile.set(result.matches);
        this.sidenavOpened.set(!result.matches);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSidenav() {
    this.sidenavOpened.update((v) => !v);
  }
}
