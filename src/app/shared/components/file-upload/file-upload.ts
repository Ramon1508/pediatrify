import { Component, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirebaseService } from '../../../core/firebase/firebase.service';
import { AlertService } from '../../../core/services/alert.service';

export interface UploadResult {
  url: string;
  path: string;
}

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
  accept = input('.png,.jpg');
  maxSize = input(200 * 1024);
  id = input<string | null>(null);

  uploaded = output<UploadResult | null>();

  protected preview = signal<string | null>(null);
  protected uploading = signal(false);
  protected fileName = signal('');

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.alert.error({ message: 'Solo se aceptan archivos .png y .jpg', duration: 5000 });
      input.value = '';
      return;
    }

    if (file.size > this.maxSize()) {
      this.alert.error({ message: `El archivo no debe superar los ${(this.maxSize() / 1024).toFixed(0)} KB`, duration: 5000 });
      input.value = '';
      return;
    }

    this.fileName.set(file.name);
    this.uploading.set(true);

    const reader = new FileReader();
    reader.onload = () => {
      this.preview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    this.uploadFile(file);
  }

  private async uploadFile(file: File) {
    try {
      const now = new Date();
      const ts = `${now.getHours()}${now.getMinutes()}${now.getDate()}${now.getMonth()}${now.getFullYear()}`;
      const idPrefix = this.id() ? `${this.id()}/` : '';
      const bucket = `logos/${idPrefix}${ts}/${file.name}`;
      const storageRef = ref(this.firebase.storage, bucket);

      const snap = await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(snap.ref);

      this.uploaded.emit({ url, path: bucket });
    } catch (e: any) {
      this.alert.error({ message: 'Error al subir el archivo', duration: 5000 });
      this.preview.set(null);
      this.fileName.set('');
    } finally {
      this.uploading.set(false);
    }
  }

  remove() {
    this.preview.set(null);
    this.fileName.set('');
    this.uploaded.emit(null);
  }
}
