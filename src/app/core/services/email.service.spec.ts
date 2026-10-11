import { TestBed } from '@angular/core/testing';
import { EmailService, ClinicEmailDeliveryError } from './email.service';
import { ClinicGatewayService } from './clinic-gateway.service';
describe('Authorized mail delivery and partial results', () => {
  const gateway = { call: vi.fn() };
  beforeEach(() => { vi.clearAllMocks(); TestBed.configureTestingModule({ providers: [{ provide: ClinicGatewayService, useValue: gateway }] }); });
  it('sends stored patient and operation identifiers, never a password or arbitrary destination', async () => {
    gateway.call.mockResolvedValue({ success: true, deliveries: [{ destination: 'primary', sent: true }, { destination: 'secondary', sent: true }] });
    await TestBed.inject(EmailService).sendPatientAccessEmail({ patientId: 'child', creationOperationId: 'create', operationId: 'delivery' });
    expect(gateway.call).toHaveBeenCalledExactlyOnceWith('sendClinicEmail', { kind: 'patient-access', patientId: 'child', creationOperationId: 'create', operationId: 'delivery' });
  });
  it('passes the invitation token and idempotent delivery operation', async () => {
    gateway.call.mockResolvedValue({ success: true, deliveries: [{ destination: 'primary', sent: true }] });
    await TestBed.inject(EmailService).sendInvitationEmail({ userId: 'invited', token: 'x'.repeat(43), operationId: 'issue' });
    expect(gateway.call).toHaveBeenCalledWith('sendClinicEmail', { kind: 'invitation', userId: 'invited', token: 'x'.repeat(43), operationId: 'issue' });
  });
  it('keeps per-recipient statuses when delivery is only partially confirmed', async () => {
    const deliveries = [{ destination: 'primary', sent: true }, { destination: 'secondary', sent: false }];
    gateway.call.mockResolvedValue({ success: false, deliveries });
    await expect(TestBed.inject(EmailService).sendPatientAccessEmail({ patientId: 'child', operationId: 'delivery' })).rejects.toMatchObject({ deliveries });
  });
  it.each([null, {}, { success: true }, { success: true, deliveries: [] }, { success: false, deliveries: [{ destination: 'primary', sent: true }] }])
    ('does not show success for an unconfirmed response %j', async response => {
      gateway.call.mockResolvedValue(response);
      await expect(TestBed.inject(EmailService).sendPatientAccessEmail({ patientId: 'child', operationId: 'delivery' })).rejects.toBeInstanceOf(ClinicEmailDeliveryError);
    });
  it('propagates transport failure without an automatic duplicate send', async () => {
    gateway.call.mockRejectedValue(new Error('Synthetic network failure'));
    await expect(TestBed.inject(EmailService).sendPatientAccessEmail({ patientId: 'child', operationId: 'delivery' })).rejects.toThrow('Synthetic network failure');
    expect(gateway.call).toHaveBeenCalledOnce();
  });
});
