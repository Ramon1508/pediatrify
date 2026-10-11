import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileUpload } from './file-upload';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { AlertService } from '../../../core/services/alert.service';
import { getDownloadURL, uploadBytes } from 'firebase/storage';

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, path) => ({ path })),
  uploadBytes: vi.fn().mockResolvedValue({ ref: { path: 'x' } }),
  getDownloadURL: vi.fn().mockResolvedValue('https://example.com/logo.png'),
}));

describe('FileUpload (P35)', () => {
  let fixture: ComponentFixture<FileUpload>;
  let component: FileUpload;
  const alert = { error: vi.fn() };

  beforeEach(() => {
    (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:pending');
    (URL as any).revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      imports: [FileUpload],
      providers: [
        { provide: FirebaseService, useValue: { storage: {} } },
        { provide: AlertService, useValue: alert },
      ],
    });
    fixture = TestBed.createComponent(FileUpload);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  function selectFile(file: File) {
    (component as any).onFileSelected({ target: { files: [file], value: '' } });
  }

  it('does not upload on selection and exposes the pending file (P35)', () => {
    fixture.componentRef.setInput('id', 'd1');
    let emitted: any;
    component.uploaded.subscribe((value) => (emitted = value));
    selectFile(new File(['x'], 'logo.png', { type: 'image/png' }));

    expect(uploadBytes).not.toHaveBeenCalled();
    expect((component as any).hasPending).toBe(true);
    expect(emitted).toEqual({ url: 'blob:pending', path: expect.stringMatching(/^logos\/d1\/[a-f0-9-]{36}_logo\.png$/) });
  });

  it('uploads the pending file on commit', async () => {
    fixture.componentRef.setInput('id', 'd1');
    selectFile(new File(['x'], 'logo.png', { type: 'image/png' }));

    const result = await (component as any).upload();

    expect(uploadBytes).toHaveBeenCalled();
    expect(getDownloadURL).toHaveBeenCalled();
    expect(result.path).toMatch(/^logos\/d1\/[a-f0-9-]{36}_logo\.png$/);
    expect(result.url).toContain('https://example.com/logo.png');
    expect((component as any).hasPending).toBe(false);
  });

  it('accepts SVG', () => {
    fixture.componentRef.setInput('id', 'd1');
    selectFile(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }));
    expect((component as any).hasPending).toBe(true);
  });

  it.each([
    ['image/gif', 10],
    ['image/png', 2 * 1024 * 1024],
  ])('rejects %s at %i bytes without staging', (type, size) => {
    fixture.componentRef.setInput('id', 'd1');
    selectFile(new File([new Uint8Array(size)], 'logo', { type }));
    expect(alert.error).toHaveBeenCalled();
    expect((component as any).hasPending).toBe(false);
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('reset discards the pending selection', () => {
    fixture.componentRef.setInput('id', 'd1');
    selectFile(new File(['x'], 'logo.png', { type: 'image/png' }));
    expect((component as any).hasPending).toBe(true);

    (component as any).reset();

    expect((component as any).hasPending).toBe(false);
  });

  it('uses distinct objects for repeated filenames and commits the exact staged path (P50)', async () => {
    fixture.componentRef.setInput('id', 'd1');
    const paths: string[] = [];
    component.uploaded.subscribe((result) => { if (result) paths.push(result.path); });
    selectFile(new File(['first'], 'logo.png', {type: 'image/png'}));
    const first = await component.upload();
    selectFile(new File(['second'], 'logo.png', {type: 'image/png'}));
    const second = await component.upload();
    expect(first?.path).toBe(paths[0]);
    expect(second?.path).toBe(paths[1]);
    expect(paths[0]).not.toBe(paths[1]);
    expect((component as any).preview()).toBe(second?.url);
  });

  it('uses distinct objects for repeated filenames and commits the exact staged path (P50)', async () => {
    fixture.componentRef.setInput('id', 'd1');
    const paths: string[] = [];
    component.uploaded.subscribe((result) => { if (result) paths.push(result.path); });
    selectFile(new File(['first'], 'logo.png', {type: 'image/png'}));
    const first = await component.upload();
    selectFile(new File(['second'], 'logo.png', {type: 'image/png'}));
    const second = await component.upload();
    expect(first?.path).toBe(paths[0]);
    expect(second?.path).toBe(paths[1]);
    expect(paths[0]).not.toBe(paths[1]);
    expect((component as any).preview()).toBe(second?.url);
  });
});
