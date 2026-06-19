import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AdminInitResult,
  AdminInitService,
} from '../../../core/services/admin-init.service';
import { AuthService } from '../../../core/services/auth.service';

const RESULT_MESSAGES: Record<AdminInitResult, string> = {
  'seed-exists': 'El administrador inicial ya existe.',
  'email-exists': 'Ya existe un usuario con el correo administrador.',
  'email-normalized': 'El correo administrador fue normalizado.',
  'admin-exists': 'Ya existe al menos un administrador registrado.',
  created: 'El administrador inicial fue creado.',
  error: 'No fue posible completar la inicialización.',
};

@Component({
  selector: 'app-admin-initialize',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './admin-initialize.html',
  styleUrl: './admin-initialize.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminInitialize implements OnInit {
  private adminInitService = inject(AdminInitService);
  private authService = inject(AuthService);

  protected loading = signal(true);
  protected result = signal<AdminInitResult | null>(null);

  async ngOnInit(): Promise<void> {
    const result = await this.adminInitService.ensureAdminExists();
    this.result.set(result);
    this.loading.set(false);
  }

  protected get message(): string {
    const result = this.result();
    return result ? RESULT_MESSAGES[result] : '';
  }

  protected get icon(): string {
    return this.result() === 'error' ? 'error' : 'check_circle';
  }
}
