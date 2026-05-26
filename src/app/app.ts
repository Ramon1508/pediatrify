import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AlertOverlay } from './shared/components/alert-overlay/alert-overlay';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AlertOverlay],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
