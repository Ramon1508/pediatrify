import { TestBed } from '@angular/core/testing';
import { AdminInitService } from './admin-init.service';
import { FirebaseService } from '../firebase/firebase.service';

describe('Retired browser administrator bootstrap', () => {
  it('cannot assign an administrator or invoke Firebase from the public browser', async () => {
    const forbidden = vi.fn(() => { throw new Error('Browser bootstrap must not use Firebase.'); });
    TestBed.configureTestingModule({ providers: [{ provide: FirebaseService, useFactory: forbidden }] });
    expect(await TestBed.inject(AdminInitService).ensureAdminExists()).toBe('error');
    expect(forbidden).not.toHaveBeenCalled();
  });
});
