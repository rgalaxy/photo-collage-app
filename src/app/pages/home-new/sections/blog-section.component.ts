import { Component, Input, Signal } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { radixArrowRight } from '@ng-icons/radix-icons';

@Component({
  selector: 'app-blog-section',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({
    radixArrowRight
  })],
  templateUrl: './blog-section.component.html',
  styleUrl: './blog-section.component.scss'
})
export class BlogSectionComponent {
  @Input() activeSection: Signal<string> | undefined;
}
