import { Component, Input, Signal, ChangeDetectionStrategy } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  radixDesktop,
  radixGear,
  radixMobile,
  radixTable
} from '@ng-icons/radix-icons';

@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({
    radixDesktop,
    radixGear,
    radixMobile,
    radixTable
  })],
  templateUrl: './about-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './about-section.component.scss'
})
export class AboutSectionComponent {
  @Input() activeSection: Signal<string> | undefined;
  @Input() skills: Array<{ name: string; description: string; icon: string }> = [];
}
