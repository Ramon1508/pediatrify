import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { NotificationRepository, NotificationPage, NotificationPayload } from '../repositories/notification.repository';
import { UserRepository } from '../repositories/user.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { AuthService } from './auth.service';
import { Appointment, Patient } from '../models/user';
import {
  AppNotification,
  NotificationFilter,
  NotificationRecipient,
  NotificationRecipientType,
  NotificationType,
} from '../models/notification';

const PAGE_SIZE = 3;

@Injectable({
  providedIn: 'root',
})
export class NotificationService implements OnDestroy {
  private repo = inject(NotificationRepository);
  private userRepo = inject(UserRepository);
  private patientRepo = inject(PatientRepository);
  private auth = inject(AuthService);

  // ---- Estado compartido (signals) ----

  /** Conteo global de no leídas del usuario actual. NO depende de lo cargado en el diálogo. */
  readonly unreadCount = signal(0);

  readonly activeFilter = signal<NotificationFilter>('all');
  readonly isInitialLoading = signal(false);
  readonly isLoadingMore = signal(false);

  readonly hasMoreAll = signal(true);
  readonly hasMoreUnread = signal(true);

  private allCache = signal<AppNotification[]>([]);
  private unreadCache = signal<AppNotification[]>([]);

  /** Lista a renderizar según el filtro activo. */
  readonly notifications = computed(() =>
    this.activeFilter() === 'all' ? this.allCache() : this.unreadCache()
  );

  readonly hasMore = computed(() =>
    this.activeFilter() === 'all' ? this.hasMoreAll() : this.hasMoreUnread()
  );

  // ---- Paginación por filtro (estados independientes) ----
  private allCursor: QueryDocumentSnapshot | null = null;
  private unreadCursor: QueryDocumentSnapshot | null = null;

  // ---- Sesión / realtime ----
  readonly recipientId = signal<string | null>(null);
  private ready = false;
  private knownIds = new Set<string>();
  private newestKnownAt: number | null = null;

  private sessionSub: Subscription | null = null;
  private realtimeSub: Subscription | null = null;
  private unreadSub: Subscription | null = null;

  constructor() {
    this.sessionSub = this.auth.session$.subscribe(() => this.onSessionChange());
  }

  ngOnDestroy() {
    this.sessionSub?.unsubscribe();
    this.realtimeSub?.unsubscribe();
    this.unreadSub?.unsubscribe();
  }

  private resolveRecipientId(): string | null {
    const doctor = this.auth.currentDoctor;
    if (doctor) return doctor.role === 'admin' ? null : doctor.uid;
    return this.auth.currentPatient?.id ?? null;
  }

  private onSessionChange() {
    const id = this.resolveRecipientId();
    this.teardown();
    this.recipientId.set(id);
    this.resetState();
    if (!id) return;

    this.startUnreadCountWatch();
    this.startRealtime();
    void this.loadFirstPage(this.activeFilter());
  }

  private teardown() {
    this.realtimeSub?.unsubscribe();
    this.realtimeSub = null;
    this.unreadSub?.unsubscribe();
    this.unreadSub = null;
  }

  /**
   * Única fuente de verdad del badge: se suscribe a `watchUnreadCount` (real-time,
   * `snapshot.size`) y setea `unreadCount`. `unreadCount` NO debe tocarse en
   * ningún otro lado para que el número siempre refleje la DB.
   */
  private startUnreadCountWatch() {
    this.unreadSub?.unsubscribe();
    const recipient = this.recipientId();
    if (!recipient) return;
    this.unreadSub = this.repo.watchUnreadCount(recipient).subscribe({
      next: (count) => this.unreadCount.set(count),
      error: (error) => console.error('watchUnreadCount error:', error),
    });
  }

  private resetState() {
    this.ready = false;
    this.knownIds = new Set();
    this.newestKnownAt = null;
    this.allCursor = null;
    this.unreadCursor = null;
    this.allCache.set([]);
    this.unreadCache.set([]);
    this.hasMoreAll.set(true);
    this.hasMoreUnread.set(true);
    this.isInitialLoading.set(false);
    this.isLoadingMore.set(false);
  }

  /** Carga la primera página del filtro activo. */
  async loadFirstPage(filter: NotificationFilter = this.activeFilter()): Promise<void> {
    const recipient = this.recipientId();
    if (!recipient) return;
    this.isInitialLoading.set(true);
    try {
      const page = await this.fetchPage(recipient, filter, null);
      this.applyPage(filter, page, true);
      if (filter === 'all') {
        this.syncNewestKnown(page.items);
        page.items.forEach((n) => this.knownIds.add(n.id));
      }
      this.ready = true;
    } catch (error) {
      console.error('loadFirstPage error:', error);
    } finally {
      this.isInitialLoading.set(false);
    }
  }

  /** Carga la siguiente página del filtro activo (infinite scroll). */
  async loadMore(): Promise<void> {
    const recipient = this.recipientId();
    const filter = this.activeFilter();
    if (!recipient || !this.ready) return;
    if (this.isLoadingMore() || !this.hasMore()) return;

    const cursor = filter === 'all' ? this.allCursor : this.unreadCursor;
    this.isLoadingMore.set(true);
    try {
      const page = await this.fetchPage(recipient, filter, cursor);
      this.applyPage(filter, page, false);
    } catch (error) {
      console.error('loadMore error:', error);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  /**
   * Obtiene una página del filtro solicitado (modelo fan-out).
   * "Todos" y "Sin leer" consultan por `recipientId == me` (+ `read == false`
   * para "Sin leer"), con paginación independiente en el backend.
   */
  private async fetchPage(
    recipient: string,
    filter: NotificationFilter,
    cursor: QueryDocumentSnapshot | null
  ): Promise<NotificationPage> {
    return this.repo.getPage(recipient, filter, PAGE_SIZE, cursor);
  }

  private isUnreadForRecipient(n: AppNotification): boolean {
    return n.read === false;
  }

  private applyPage(filter: NotificationFilter, page: NotificationPage, replace: boolean) {
    const existing = replace ? [] : (filter === 'all' ? this.allCache() : this.unreadCache());
    const seen = new Set(existing.map((n) => n.id));
    const deduped = page.items.filter((n) => !seen.has(n.id));

    if (filter === 'all') {
      this.allCache.set([...existing, ...deduped]);
      this.allCursor = page.lastVisible;
      this.hasMoreAll.set(page.items.length === PAGE_SIZE && page.lastVisible !== null);
    } else {
      this.unreadCache.set([...existing, ...deduped]);
      this.unreadCursor = page.lastVisible;
      this.hasMoreUnread.set(page.items.length === PAGE_SIZE && page.lastVisible !== null);
    }
  }

  private syncNewestKnown(items: AppNotification[]) {
    for (const n of items) {
      const ts = this.toMillis(n.createdAt);
      if (this.newestKnownAt === null || ts > this.newestKnownAt) {
        this.newestKnownAt = ts;
      }
    }
  }

  /** Cambia de filtro. La paginación de "Todos" y "Sin leer" son independientes. */
  async setFilter(filter: NotificationFilter): Promise<void> {
    if (filter === this.activeFilter()) return;
    this.activeFilter.set(filter);
    const isLoaded = filter === 'all' ? this.allCache().length > 0 : this.unreadCache().length > 0;
    if (!isLoaded) {
      await this.loadFirstPage(filter);
    }
  }

  /** Marca UNA notificación del destinatario como leída (el badge lo baja la subscripción). */
  async markAsRead(notificationId: string): Promise<void> {
    const recipient = this.recipientId();
    if (!recipient) return;

    try {
      await this.repo.markRead(notificationId);
    } catch (error) {
      console.error('markRead error:', error);
    }

    const markReadInList = (list: AppNotification[]): AppNotification[] =>
      list.map((n) => (n.id === notificationId ? { ...n, read: true } : n));

    this.allCache.set(markReadInList(this.allCache()));
    this.unreadCache.set(this.unreadCache().filter((n) => n.id !== notificationId));
  }

  /**
   * Marca como leídas TODAS las notificaciones de citas canceladas del
   * destinatario actual. Se invoca al cerrar el diálogo. El badge NO se toca
   * aquí: lo actualiza `watchUnreadCount` (onSnapshot) al cambiar la DB.
   */
  async markCancelledRead(): Promise<void> {
    const recipient = this.recipientId();
    if (!recipient) return;

    let dbMarked: string[] = [];
    try {
      dbMarked = await this.repo.markAllCancelledRead(recipient);
    } catch (error) {
      console.error('markAllCancelledRead error:', error);
    }

    const cachedCancelled = this.allCache().filter(
      (n) => n.type === 'appointment-cancelled' && this.isUnreadForRecipient(n)
    );
    const ids = new Set<string>([...cachedCancelled.map((n) => n.id), ...dbMarked]);

    await Promise.all([...ids].map((id) => this.markAsRead(id)));

    this.allCache.set(
      this.allCache().map((n) => (ids.has(n.id) ? { ...n, read: true } : n))
    );
    this.unreadCache.set(this.unreadCache().filter((n) => !ids.has(n.id)));
  }

  /** Limpia caché y reconstruye la primera página (refresh manual). */
  async refresh(): Promise<void> {
    this.ready = false;
    this.knownIds = new Set();
    this.newestKnownAt = null;
    this.allCursor = null;
    this.unreadCursor = null;
    this.allCache.set([]);
    this.unreadCache.set([]);
    this.hasMoreAll.set(true);
    this.hasMoreUnread.set(true);
    await this.loadFirstPage(this.activeFilter());
  }

  // ---- Realtime ----

  private startRealtime() {
    const recipient = this.recipientId();
    if (!recipient) return;
    this.realtimeSub = this.repo.watchForRecipient(recipient).subscribe((latest) => {
      if (!this.ready) return;
      for (const n of latest) {
        if (this.knownIds.has(n.id)) continue;
        if (this.newestKnownAt !== null && this.toMillis(n.createdAt) <= this.newestKnownAt) {
          continue;
        }
        this.prependNew(n);
      }
    });
  }

  private prependNew(n: AppNotification) {
    this.knownIds.add(n.id);
    const ts = this.toMillis(n.createdAt);
    if (this.newestKnownAt === null || ts > this.newestKnownAt) {
      this.newestKnownAt = ts;
    }
    this.allCache.set([n, ...this.allCache()]);

    const isUnread = n.read === false;
    if (isUnread) {
      this.unreadCache.set([n, ...this.unreadCache()]);
    }
  }

  private toMillis(value: AppNotification['createdAt']): number {
    if (value && typeof (value as any).toMillis === 'function') {
      return (value as any).toMillis();
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return new Date(String(value)).getTime();
  }

  // ---- Generación de notificaciones (sin cambios) ----

  private currentActor(): { id: string; name: string } | null {
    const doctor = this.auth.currentDoctor;
    if (doctor) return { id: doctor.uid, name: doctor.name };
    const patient = this.auth.currentPatient;
    if (patient) return { id: patient.id, name: `${patient.name} ${patient.lastName}`.trim() };
    return null;
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private patientName(appointment: Appointment): string {
    return `${appointment.patientName ?? ''} ${appointment.patientLastName ?? ''}`.trim();
  }

  private async buildRecipients(
    doctorId: string,
    patientId: string
  ): Promise<NotificationRecipient[]> {
    const map = new Map<string, NotificationRecipient>();
    const add = (id: string, type: NotificationRecipientType) => {
      if (!id || map.has(id)) return;
      map.set(id, { recipientId: id, recipientType: type });
    };

    const primary = await this.userRepo.getUser(doctorId);
    if (primary && primary.role !== 'admin') {
      if (primary.role === 'assistant') {
        add(primary.uid, 'assistant');
        const ownerDoctor = await this.userRepo.getUser(primary.createdBy ?? '');
        if (ownerDoctor && ownerDoctor.role === 'doctor') {
          add(ownerDoctor.uid, 'doctor');
          const ownerAssistants =
            await this.userRepo.getAssistantsByDoctor(ownerDoctor.uid);
          for (const assistant of ownerAssistants) {
            add(assistant.uid, 'assistant');
          }
        }
      } else {
        add(primary.uid, 'doctor');
        const assistants = await this.userRepo.getAssistantsByDoctor(doctorId);
        for (const assistant of assistants) {
          add(assistant.uid, 'assistant');
        }
      }
    }

    const patient = await this.patientRepo.getPatient(patientId);
    if (patient) {
      await this.addPatientFamily(patient, map, add);
    }

    return [...map.values()];
  }

  private async addPatientFamily(
    patient: Patient,
    map: Map<string, NotificationRecipient>,
    add: (id: string, type: NotificationRecipientType) => void
  ): Promise<void> {
    const familyIds = new Set<string>();
    familyIds.add(patient.id);
    const emails = [patient.email, patient.secondaryEmail ?? ''];
    for (const email of emails) {
      if (!email) continue;
      const family = await this.patientRepo.findPatientsByLoginEmail(email);
      for (const member of family) {
        familyIds.add(member.id);
      }
    }
    for (const familyId of familyIds) {
      add(familyId, 'patient');
    }
  }

  private async persist(
    type: NotificationType,
    title: string,
    description: string,
    appointmentId: string,
    doctorId: string,
    patientId: string
  ): Promise<void> {
    try {
      const actor = this.currentActor();
      const recipients = await this.buildRecipients(doctorId, patientId);
      if (!recipients.length) return;

      const payload: NotificationPayload = {
        type,
        title,
        description,
        appointmentId,
        originatorId: actor?.id ?? '',
        originatorName: actor?.name ?? '',
      };
      // Fan-out: un doc por destinatario en un único writeBatch.
      await this.repo.createMany(payload, recipients);
    } catch (error) {
      console.error('Error al generar notificación', error);
    }
  }

  async notifyAppointmentCreated(appointment: Appointment): Promise<void> {
    const description = `Nueva consulta agendada con ${this.patientName(appointment)} para el ${this.formatDate(appointment.date)} a las ${appointment.time}.`;
    await this.persist(
      'appointment-created',
      'Consulta agendada',
      description,
      appointment.id,
      appointment.doctorId,
      appointment.patientId
    );
  }

  async notifyAppointmentCancelled(appointment: Appointment): Promise<void> {
    const description = `${this.patientName(appointment)} canceló su consulta programada para el ${this.formatDate(appointment.date)} a las ${appointment.time}.`;
    await this.persist(
      'appointment-cancelled',
      'Consulta cancelada',
      description,
      appointment.id,
      appointment.doctorId,
      appointment.patientId
    );
  }

  async notifyAppointmentRescheduled(
    appointment: Appointment,
    previousDate: string,
    previousTime: string
  ): Promise<void> {
    const description = `${this.patientName(appointment)} reagendó su consulta del ${this.formatDate(previousDate)} a las ${previousTime} al ${this.formatDate(appointment.date)} a las ${appointment.time}.`;
    await this.persist(
      'appointment-rescheduled',
      'Consulta reagendada',
      description,
      appointment.id,
      appointment.doctorId,
      appointment.patientId
    );
  }
}
