import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { AuditRepository } from '../../core/repositories/audit.repository';
import { AuditEntry } from '../../core/models/user';

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-MX');
}

function formatChanges(entry: AuditEntry): string {
  const parts: string[] = [];
  if (entry.oldValues) {
    parts.push('Anterior: ' + JSON.stringify(entry.oldValues));
  }
  if (entry.newValues) {
    parts.push('Nuevo: ' + JSON.stringify(entry.newValues));
  }
  return parts.join(' | ') || '—';
}

@Component({
  selector: 'app-audit-log',
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatProgressBarModule,
    MatButtonModule,
  ],
})
export class AuditLog implements OnInit {
  private auditRepo = inject(AuditRepository);
  private readonly destroyRef = inject(DestroyRef);
  private subscription: Subscription | null = null;

  protected entries = signal<AuditEntry[]>([]);
  protected loading = signal(true);
  protected readonly error = signal(false);
  protected readonly displayedColumns = signal(['action', 'entityType', 'entityId', 'performedBy', 'timestamp', 'changes']);

  protected rows = computed(() =>
    this.entries().map((e) => ({
      ...e,
      timestampLabel: formatTimestamp(e.timestamp),
      changesLabel: formatChanges(e),
      entityIdLabel: e.entityId.length > 8 ? `${e.entityId.slice(0, 8)}…` : e.entityId,
    }))
  );

  ngOnInit() {
    this.load();
  }

  load() {
    this.subscription?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.entries.set([]);
    this.subscription = this.auditRepo.watchAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.entries.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.entries.set([]);
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
