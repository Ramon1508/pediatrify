import { TestBed } from '@angular/core/testing';
import { NotificationRepository } from './notification.repository';
import { FirebaseService } from '../firebase/firebase.service';
import { AppNotification } from '../models/notification';

// ---- In-memory fake de firebase/firestore ----
// La colección `notifications` vive en `store`. `getDocs` evalúa las constraints
// (where/orderBy/limit/startAfter) tal como lo haría Firestore para cubrir la
// lógica real del repositorio (paginación, igualdad, array-contains, orden).
const { store, firestoreModule } = vi.hoisted(() => {
  const store = new Map<string, any>();

  const fs: any = {
    collection: (db: any, name: string) => ({ db, name }),
    doc: (db: any, name: string, id: string) => ({ db, name, id, path: `${name}/${id}` }),
    query: (...args: any[]) => {
      const constraints: any = { wheres: [], orderBy: null, limit: Infinity, startAfter: null, db: null, name: null };
      for (const a of args) {
        if (a && a.__isQuery) {
          constraints.wheres = [...a.wheres];
          constraints.orderBy = a.orderBy;
          constraints.limit = a.limit;
          constraints.startAfter = a.startAfter;
        } else if (a && a.__op === 'where') {
          constraints.wheres.push(a);
        } else if (a && a.__op === 'orderBy') {
          constraints.orderBy = a;
        } else if (a && a.__op === 'limit') {
          constraints.limit = a.value;
        } else if (a && a.__op === 'startAfter') {
          constraints.startAfter = a.value;
        }
      }
      return { ...constraints, __isQuery: true };
    },
    where: (field: string, op: string, value: any) => ({ __op: 'where', field, op, value }),
    orderBy: (field: string, dir: string) => ({ __op: 'orderBy', field, dir }),
    limit: (value: number) => ({ __op: 'limit', value }),
    startAfter: (value: any) => ({ __op: 'startAfter', value }),
    getDocs: async (constraints: any) => {
      let docs = [...store.entries()].map(([id, d]) => ({ id, data: () => d, ref: { id, path: `notifications/${id}` } } as any));
      for (const w of constraints.wheres) {
        const field = w.field;
        const value = w.value;
        if (w.op === 'array-contains') {
          docs = docs.filter((d) => Array.isArray(d.data()[field]) && d.data()[field].includes(value));
        } else if (w.op === '==') {
          docs = docs.filter((d) => d.data()[field] === value);
        }
      }
      const field = constraints.orderBy?.field;
      const dir = constraints.orderBy?.dir;
      if (field && dir) {
        docs = docs.sort((a: any, b: any) => {
          const av = field === 'createdAt' ? Date.parse(new Date(String(a.data()[field])).toISOString()) : 0;
          const bv = field === 'createdAt' ? Date.parse(new Date(String(b.data()[field])).toISOString()) : 0;
          const diff = field === 'createdAt'
            ? av - bv
            : String(a.data()[field]).localeCompare(String(b.data()[field]));
          return dir === 'desc' ? -diff : diff;
        });
      }
      if (constraints.startAfter) {
        const lastId = constraints.startAfter.id;
        const idx = docs.findIndex((d) => d.id === lastId);
        if (idx >= 0) docs = docs.slice(idx + 1);
      }
      docs = docs.slice(0, constraints.limit);
      return { docs };
    },
    getDoc: async (ref: any) => {
      const d = store.get(ref.id);
      return { exists: () => !!d, data: () => d, ref };
    },
    setDoc: async (ref: any, data: any) => {
      store.set(ref.id, { ...data, id: ref.id });
    },
    updateDoc: async (ref: any, patch: any) => {
      store.set(ref.id, { ...store.get(ref.id), ...patch });
    },
    writeBatch: () => {
      const ops: Array<() => void> = [];
      return {
        set: (ref: any, data: any) => {
          ops.push(() => store.set(ref.id, { ...data, id: ref.id }));
        },
        update: (ref: any, patch: any) => {
          ops.push(() => store.set(ref.id, { ...store.get(ref.id), ...patch }));
        },
        delete: (ref: any) => {
          ops.push(() => store.delete(ref.id));
        },
        commit: async () => {
          for (const op of ops) op();
        },
      };
    },
    Timestamp: { now: () => new Date() },
    serverTimestamp: () => new Date(),
    onSnapshot: (q: any, onNext: any) => {
      fs.getDocs(q).then(({ docs }: any) => onNext({ size: docs.length, docs }));
      return () => undefined;
    },
  };

  return { store, firestoreModule: fs };
});

vi.mock('firebase/firestore', () => firestoreModule);

function notif(id: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    type: 'appointment-created',
    title: 'Consulta agendada',
    description: 'Nueva consulta agendada con Ana Rangel.',
    appointmentId: 'apt1',
    createdAt: new Date(),
    originatorId: 'doc2',
    originatorName: 'Otro',
    recipientId: 'doc1',
    recipientType: 'doctor',
    read: false,
    ...overrides,
  };
}

describe('NotificationRepository', () => {
  let repo: NotificationRepository;

  function seed(items: AppNotification[]) {
    store.clear();
    for (const n of items) {
      store.set(n.id, { ...n });
    }
  }

  function read(id: string): any {
    return store.get(id);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationRepository, { provide: FirebaseService, useValue: { firestore: {} } }],
    });
    repo = TestBed.inject(NotificationRepository);
  });

  afterEach(() => store.clear());

  it('createMany crea un doc por destinatario con read=false', async () => {
    store.clear();
    await repo.createMany(
      { type: 'appointment-created', title: 'Consulta agendada', description: 'Nueva consulta.', appointmentId: 'apt1', originatorId: 'doc2', originatorName: 'Otro' },
      [{ recipientId: 'doc1', recipientType: 'doctor' }, { recipientId: 'a1', recipientType: 'assistant' }]
    );

    expect(store.size).toBe(2);
    const docs = [...store.values()];
    for (const d of docs) {
      expect(d.read).toBe(false);
      expect(d.recipientType).toBeDefined();
    }
    expect(docs.map((d) => d.recipientId)).toEqual(expect.arrayContaining(['doc1', 'a1']));
  });

  it('getPage("all") pagina por recipientId con orden createdAt desc', async () => {
    const n3 = notif('n3', { createdAt: new Date('2026-08-12T10:00:00') });
    const n2 = notif('n2', { createdAt: new Date('2026-08-12T09:00:00') });
    const n1 = notif('n1', { createdAt: new Date('2026-08-12T08:00:00') });
    seed([n2, n1, n3]);

    const page = await repo.getPage('doc1', 'all', 3, null);
    expect(page.items.map((n) => n.id)).toEqual(['n3', 'n2', 'n1']);
  });

  it('getPage("unread") devuelve solo las no leídas del destinatario', async () => {
    seed([
      notif('n1', { read: false, createdAt: new Date('2026-08-12T08:00:00') }),
      notif('n2', { read: true, createdAt: new Date('2026-08-12T09:00:00') }),
    ]);
    const page = await repo.getPage('doc1', 'unread', 3, null);
    expect(page.items.map((n) => n.id)).toEqual(['n1']);
  });

  it('watchUnreadCount emite el número de no leídas del destinatario en tiempo real', async () => {
    seed([
      notif('n1', { read: false, createdAt: new Date('2026-08-12T08:00:00') }),
      notif('n2', { read: true, createdAt: new Date('2026-08-12T09:00:00') }),
    ]);

    const counts: number[] = [];
    const done = new Promise<void>((resolve) => {
      repo.watchUnreadCount('doc1').subscribe({
        next: (count) => {
          counts.push(count);
          resolve();
        },
      });
    });
    await done;
    expect(counts[0]).toBe(1);
  });

  it('markRead pone read=true (sin tocar a otros destinatarios)', async () => {
    seed([notif('n1')]);
    await repo.markRead('n1');
    expect(read('n1').read).toBe(true);
  });

  it('markAllCancelledRead marca solo las canceladas no leídas del destinatario', async () => {
    seed([
      notif('nCanc', { type: 'appointment-cancelled', read: false, createdAt: new Date('2026-08-12T10:00:00') }),
      notif('nRes', { type: 'appointment-rescheduled', read: false, createdAt: new Date('2026-08-12T09:00:00') }),
      notif('nReadCanc', { type: 'appointment-cancelled', read: true, createdAt: new Date('2026-08-12T08:00:00') }),
    ]);

    const marked = await repo.markAllCancelledRead('doc1');

    expect(marked).toEqual(['nCanc']);
    expect(read('nCanc').read).toBe(true);
    expect(read('nRes').read).toBe(false);
  });

  it('paginates markAllCancelledRead across pages when there are more than the page size', async () => {
    const items: AppNotification[] = [];
    for (let i = 0; i < 150; i++) {
      items.push(notif(`c${i}`, { type: 'appointment-cancelled', read: false, createdAt: new Date(Date.UTC(2026, 7, 1, 0, i)) }));
    }
    seed(items);

    const marked = await repo.markAllCancelledRead('doc1');
    expect(marked.length).toBe(150);
  });
});
