import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import photoBlursJson from '../../../public/assets/photo-blurs.json';
const photoBlurs: Record<string, string> = photoBlursJson;

@Component({
  selector: 'app-photo-list',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './photo-list.component.html',
  styleUrl: './photo-list.component.scss'
})
export class PhotoListComponent {
  photos = Array.from({ length: 27 }).map((_, i) => `assets/photos/maternity/TR-${i + 1}.jpg`);

  randomHeights = this.photos.map(() => this.getRandomHeight());
  selectedPhoto: string | null = null;
  loadedImages = new Set<string>();

  blurMap = photoBlurs

  private getRandomHeight(): string {
    const min = 200;
    const max = 400;
    const step = 20;
    const steps = (max - min) / step + 1;
    const randomStep = Math.floor(Math.random() * steps);
    const randomHeight =  `${min + randomStep * step}px`;

    return randomHeight;
  }

  onImageLoad(photo: string) {
    this.loadedImages.add(photo);
  }

  isLoaded(photo: string): boolean {
    return this.loadedImages.has(photo);
  }

  getFileName(photo: string): string {
    return photo.split('/').pop()!;
  }

  getPlaceholder(photo: string): string {
    return this.blurMap[this.getFileName(photo)];
  }

  openModal(photo: string) {
    this.selectedPhoto = photo;
    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    this.selectedPhoto = null;
    document.body.style.overflow = '';
  }


  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent) {
    this.closeModal();
  }
}
