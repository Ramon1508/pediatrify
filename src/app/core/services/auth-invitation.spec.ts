import { TestBed } from '@angular/core/testing';
import { signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { authFixture } from '../../../../security/p01/angular-auth-fixture';
const profile = { sexo: 3, phone: '', especialidad: '', cedula: '', cedulaEspecialidad: '', consultorios: '' };
describe('Invitation registration through trusted backend', () => {
  beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { TestBed.resetTestingModule(); sessionStorage.clear(); });
  it('delegates registration and closes the local session only after confirmation', async () => {
    const { auth, invitations } = authFixture('assistant');
    await auth.registerFromInvitation('x'.repeat(43), 'Synthetic123!', profile, 'operation');
    expect(invitations.complete).toHaveBeenCalledExactlyOnceWith('x'.repeat(43), 'Synthetic123!', profile, 'operation');
    expect(signOut).toHaveBeenCalledOnce(); expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });
  it('failure does not switch Auth identity or finish the profile locally', async () => {
    const { auth, invitations, gateway } = authFixture('assistant');
    invitations.complete.mockRejectedValue({ code: 'functions/failed-precondition' });
    await expect(auth.registerFromInvitation('x'.repeat(43), 'Synthetic123!', profile, 'operation')).rejects.toEqual({ code: 'functions/failed-precondition' });
    expect(signOut).not.toHaveBeenCalled(); expect(gateway.publish).not.toHaveBeenCalled();
  });
});
