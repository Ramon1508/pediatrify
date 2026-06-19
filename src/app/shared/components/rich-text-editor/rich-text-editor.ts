import { Component, ElementRef, inject, ChangeDetectionStrategy, forwardRef, AfterViewInit, OnDestroy } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import Quill from 'quill';

@Component({
  selector: 'app-rich-text-editor',
  template: '<div #editorContainer></div>',
  styles: [`
    :host {
      display: block;
      min-height: 300px;
    }
    :host ::ng-deep .ql-editor {
      min-height: 200px;
    }
  `],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditor),
      multi: true,
    },
  ],
})
export class RichTextEditor implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private el = inject(ElementRef).nativeElement as HTMLElement;
  private editor: any = null;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingValue: string | null = null;

  ngAfterViewInit() {
    const container = this.el.querySelector('div');
    if (!container) return;
    this.editor = new Quill(container as HTMLElement, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          ['link', 'image'],
          ['clean'],
        ],
      },
    });
    this.editor.on('text-change', () => {
      const html = this.editor.root.innerHTML;
      this.onChange(html === '<p><br></p>' ? '' : html);
    });
    this.editor.on('selection-change', (range: any) => {
      if (!range) this.onTouched();
    });
    if (this.pendingValue !== null) {
      this.editor.root.innerHTML = this.pendingValue;
      this.pendingValue = null;
    }
  }

  writeValue(value: string): void {
    if (this.editor) {
      this.editor.root.innerHTML = value ?? '';
    } else {
      this.pendingValue = value ?? '';
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.editor) {
      this.editor.enable(!isDisabled);
    }
  }

  ngOnDestroy() {
    if (this.editor) {
      this.editor = null;
    }
  }
}
