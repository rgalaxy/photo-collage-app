import { Component, Input, Signal } from '@angular/core';

@Component({
  selector: 'app-portfolio-section',
  standalone: true,
  imports: [],
  templateUrl: './portfolio-section.component.html',
  styleUrl: './portfolio-section.component.scss'
})
export class PortfolioSectionComponent {
  @Input() activeSection: Signal<string> | undefined;
}
