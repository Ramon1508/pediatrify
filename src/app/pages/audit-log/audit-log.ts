import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
  ],
})
export class AuditLog implements OnInit {
  private auditRepo = inject(AuditRepository);

  protected entries = signal<AuditEntry[]>([]);
  protected loading = signal(true);
  protected displayedColumns = ['action', 'entityType', 'entityId', 'performedBy', 'timestamp', 'changes'];

  protected rows = computed(() =>
    this.entries().map((e) => ({
      ...e,
      timestampLabel: formatTimestamp(e.timestamp),
      changesLabel: formatChanges(e),
    }))
  );

  ngOnInit() {
    this.auditRepo.watchAll().subscribe((items) => {
      this.entries.set(items);
      this.loading.set(false);
    });
  }
}
