import { Component, inject, input, output, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { AlertService } from '../../../core/services/alert.service';
import { createLogoObjectPath } from '../../../core/utils/logo-utils';

export interface UploadResult {
  url: string;
  path: string;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
})
export class FileUpload {
  private firebase = inject(FirebaseService);
  private alert = inject(AlertService);

  label = input('Seleccionar archivo');
  accept = input('.png,.jpg,.jpeg,.svg');
  maxSize = input(1024 * 1024);
  id = input<string | null>(null);
  initialPreview = input('');
  initialFileName = input('');

  /**
   * Emite la selección pendiente con una URL de previsualización (object URL) y la
   * ruta destino; NO sube el archivo. El padre debe llamar a `upload()` al guardar,
   * de modo que cancelar descarte la selección sin escribir en Storage (P35).
   */
  uploaded = output<UploadResult | null>();

  protected preview = signal<string | null>(null);
  protected uploading = signal(false);
  protected fileName = signal('');

  private pendingFile: File | null = null;
  private objectUrl: string | null = null;
  private pendingPath = '';

  constructor() {
    effect(() => {
      const url = this.initialPreview();
      this.preview.set(url || null);
      this.fileName.set(url ? this.initialFileName() : '');
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    if (!ALLOWED_TYPES.includes(file.type)) {
      this.alert.error({ message: 'Solo se aceptan archivos .png, .jpg y .svg', duration: 5000 });
      input.value = '';
      return;
    }

    if (file.size > this.maxSize()) {
      this.alert.error({ message: `El archivo no debe superar los ${Math.round(this.maxSize() / 1024 / 1024)} MB`, duration: 5000 });
      input.value = '';
      return;
    }

    this.clearPending();
    this.pendingFile = file;
    this.pendingPath = createLogoObjectPath(this.id(), file.name);
    this.fileName.set(file.name);
    this.objectUrl = URL.createObjectURL(file);
    this.preview.set(this.objectUrl);
    this.uploaded.emit({ url: this.objectUrl, path: this.pendingPath });
    input.value = '';
  }

  /** Sube el archivo seleccionado, si lo hay. Devuelve la referencia final o null. */
  async upload(): Promise<UploadResult | null> {
    const file = this.pendingFile;
    if (!file) return null;
    this.uploading.set(true);
    try {
      const bucket = this.pendingPath;
      const storageRef = ref(this.firebase.storage, bucket);
      const snap = await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(snap.ref);
      const separator = url.includes('?') ? '&' : '?';
      this.clearPending();
      const result = { url: `${url}${separator}v=${Date.now()}`, path: bucket };
      this.preview.set(result.url);
      return result;
    } catch {
      this.alert.error({ message: 'Error al subir el archivo', duration: 5000 });
      return null;
    } finally {
      this.uploading.set(false);
    }
  }

  get hasPending(): boolean {
    return this.pendingFile !== null;
  }

  remove() {
    this.clearPending();
    this.preview.set(null);
    this.fileName.set('');
    this.uploaded.emit(null);
  }

  /** Descarta una selección pendiente sin emitir (p. ej. al cancelar la edición). */
  reset() {
    this.clearPending();
    const url = this.initialPreview();
    this.preview.set(url || null);
    this.fileName.set(url ? this.initialFileName() : '');
  }

  private clearPending() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.pendingFile = null;
    this.pendingPath = '';
  }
}
