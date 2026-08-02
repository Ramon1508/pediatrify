import { signal, computed, Signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';

export class SignalStore<T extends { id: string }> {
  protected items = signal<Map<string, T>>(new Map());
  private queries = new Map<string, { signal: Signal<T[]>; unsub: () => void; refs: number }>();
  private oneSubs = new Map<string, { unsub: () => void; refs: number }>();
  private allFactory: (() => Observable<T[]>) | null = null;

  constructor(
    allFactory: (() => Observable<T[]>) | null,
    private oneFactory: (id: string) => Observable<T | null>,
  ) {
    this.allFactory = allFactory;
  }

  protected watchQuery(key: string, factory: () => Observable<T[]>): Signal<T[]> {
    const cached = this.queries.get(key);
    if (cached) {
      cached.refs++;
      return cached.signal;
    }

    const listSig = signal<T[]>([]);
    const readonly = listSig.asReadonly();
    let qSub: { unsubscribe(): void } | null = null;
    const unsub = () => qSub?.unsubscribe();
    const entry = { signal: readonly, unsub, refs: 1 };
    this.queries.set(key, entry);

    setTimeout(() => {
      qSub = factory().subscribe((items) => {
        listSig.set(items);
        untracked(() => {
          const map = new Map(this.items());
          for (const item of items) map.set(item.id, item);
          this.items.set(map);
        });
      });
    }, 0);

    return readonly;
  }

  protected unwatchQuery(key: string): void {
    const cached = this.queries.get(key);
    if (!cached) return;
    cached.refs--;
    if (cached.refs <= 0) {
      cached.unsub();
      this.queries.delete(key);
    }
  }

  watchAll(): Signal<T[]> {
    if (!this.allFactory) throw new Error('watchAll not supported by this store');
    return this.watchQuery('__all__', this.allFactory);
  }

  unwatchAll(): void {
    this.unwatchQuery('__all__');
  }

  watchOne(id: string): Signal<T | null> {
    const sub = this.oneSubs.get(id);
    if (sub) {
      sub.refs++;
      return computed(() => this.items().get(id) ?? null);
    }

    const oSub = this.oneFactory(id).subscribe((item) => {
      if (item) {
        untracked(() => {
          const map = new Map(this.items());
          map.set(item.id, item);
          this.items.set(map);
        });
      }
    });
    this.oneSubs.set(id, { unsub: () => oSub.unsubscribe(), refs: 1 });
    return computed(() => this.items().get(id) ?? null);
  }

  unwatchOne(id: string): void {
    const sub = this.oneSubs.get(id);
    if (!sub) return;
    sub.refs--;
    if (sub.refs <= 0) {
      sub.unsub();
      this.oneSubs.delete(id);
    }
  }
}
