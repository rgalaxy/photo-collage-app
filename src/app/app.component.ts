import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    standalone: true,
    templateUrl: './app.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(private theme: ThemeService) {}
  title = 'photo-collage-app';

  toggleTheme() {
    this.theme.toggleTheme();
  }
}
