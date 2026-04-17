import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  PLATFORM_ID,
  ElementRef,
  ViewChild,
  Renderer2,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-chloe-birthday',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chloe-birthday.component.html',
  styleUrls: ['./chloe-birthday.component.scss'],
})
export class ChloeBirthdayComponent implements OnInit, AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private renderer = inject(Renderer2);
  private el = inject(ElementRef);
  private seo = inject(SeoService);
  private route = inject(ActivatedRoute);

  @ViewChild('rundownSection') rundownSection!: ElementRef;

  // ── Background Music ──
  private audio: HTMLAudioElement | null = null;
  // Adjust this value (0.0 to 1.0) to change the background music volume
  private readonly MUSIC_VOLUME = 0.5;
  private readonly musicTracks = [
    'assets/musics/background-birthday-1.mp3',
    'assets/musics/background-birthday-2.mp3',
    'assets/musics/background-birthday-3.mp3',
    'assets/musics/background-birthday-4.mp3',
    'assets/musics/background-birthday-5.mp3',
  ];
  isMusicPlaying = false;
  showSplash = true;
  isFamilyVariant = false;

  readonly collagePhotos = [
    { src: 'assets/photos/family/family-1.jpeg', alt: 'Family moment 1' },
    { src: 'assets/photos/family/family-2.jpeg', alt: 'Family moment 2' },
    { src: 'assets/photos/family/family-3.jpeg', alt: 'Family moment 3' },
    { src: 'assets/photos/family/family-4.jpeg', alt: 'Family moment 4' },
    { src: 'assets/photos/family/family-5.jpeg', alt: 'Family moment 5' },
    { src: 'assets/photos/family/family-6.jpeg', alt: 'Family moment 6' },
    { src: 'assets/photos/family/family-7.jpeg', alt: 'Family moment 7' },
    { src: 'assets/photos/family/family-8.jpeg', alt: 'Family moment 8' },
    { src: 'assets/photos/family/family-9.jpeg', alt: 'Family moment 9' },
    { src: 'assets/photos/family/family-10.jpeg', alt: 'Family moment 10' },
  ];

  rundownItems = [
    { time: '12:00 – 12:10', event: 'Welcome Speech', description: 'by Monica Martin', icon: '🎤' },
    { time: '12:10 – 12:15', event: 'Meal Prayer', description: '', icon: '🙏' },
    { time: '12:15 – 13:00', event: 'Lunch Time', description: 'Enjoy the feast!', icon: '🍽️' },
    { time: '13:00 – 13:30', event: 'Ice Breaker', description: 'Fun games for everyone', icon: '🎲' },
    { time: '13:30 – 14:00', event: 'Sermon & Prayer', description: '', icon: '📖' },
    { time: '14:00 – 15:00', event: 'Happy Birthday & Photo Session', description: 'Celebrate with Chloe!', icon: '🎂' },
    { time: '15:00 – 16:00', event: 'Smash Cake & Sensory Play', description: 'Messy fun for the little ones', icon: '🎨' },
    { time: '16:00 – 17:00', event: 'Baby Clean Up', description: 'Freshen up the little ones', icon: '🛁' },
    { time: '17:00 – 17:10', event: 'Farewell & Hampers Distribution', description: 'Thank you for coming!', icon: '🎁' },
  ];

  notes = [
    {
      icon: '📍',
      text: 'Here is the map to Chloe\'s Home',
      link: 'https://maps.app.goo.gl/ynj44KzMmdXEY1rp9',
      linkText: 'Get Directions',
    },
    {
      icon: '🍼',
      text: 'If your kid is under 1 year old, we encourage parents to bring their own baby food (MPASI) since each kid has different preferences.',
    },
    {
      icon: '👕',
      text: 'One of our main events is 🎉sensory play🎉 together with Chloe, so please bring extra clothes for you and your kid.',
    },
    {
      icon: '👩‍👧',
      text: 'For those who bring a babysitter, we will also provide 1 portion of food.',
    },
    {
      icon: '👗',
      text: 'To match the theme of the event, we ask that you please refrain from wearing yellow clothing.',
    },
    {
      icon: '😋',
      text: 'Please come with an empty stomach so we can enjoy the food provided together!',
    },
  ];

  private fontsLoaded = false;

  ngOnInit(): void {
    this.isFamilyVariant = this.route.snapshot.data['variant'] === 'family';

    if (this.isFamilyVariant) {
      this.seo.updateSEO({
        title: "Chloe's 1st Birthday – Family Sunday Celebration 🎂",
        description:
          "Join us for a family Sunday celebration of Chloe Zevanya Eleanor Ong's 1st birthday! Sunday, 19 April 2026 at 11:30 AM. After Sunday Service.",
        ogTitle: "Family Sunday Celebration – Chloe's 1st Birthday! 🎂",
        ogDescription:
          "Celebrate Chloe turning 1 with family! Sunday, 19 April 2026 · 11:30 AM · Mega Cinere, Depok.",
        ogImage: 'https://martinharyanto.netlify.app/assets/photos/chloe-only.jpg',
        ogUrl: 'https://martinharyanto.netlify.app/event/chloe-1st-birthday/family',
        type: 'website',
      });
    } else {
      this.seo.updateSEO({
        title: "Chloe's 1st Birthday Party 🎂 – You're Invited!",
        description:
          "Join us to celebrate Chloe Zevanya Eleanor Ong's 1st birthday! Saturday, 18 April 2026 at 12:00 PM. Chloe's Home, Jl Magelang No 292, Mega Cinere, Depok.",
        ogTitle: "You're Invited to Chloe's 1st Birthday Party! 🎂",
        ogDescription:
          "Join us to celebrate Chloe Zevanya Eleanor Ong turning 1! Saturday, 18 April 2026 · 12:00 PM · Mega Cinere, Depok.",
        ogImage: 'https://martinharyanto.netlify.app/assets/photos/chloe-only.jpg',
        ogUrl: 'https://martinharyanto.netlify.app/event/chloe-1st-birthday',
        type: 'website',
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      this.loadFonts();
      gsap.registerPlugin(ScrollTrigger);
      this.prepareMusic();
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.createStars();
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      ScrollTrigger.getAll().forEach((t) => t.kill());
      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }
    }
  }

  /** Called when user taps the splash overlay — this is a real user gesture */
  enterPage(): void {
    this.showSplash = false;
    // Start music directly inside the user gesture — guaranteed to work on mobile
    if (this.audio) {
      this.audio.play().then(() => {
        this.isMusicPlaying = true;
      }).catch(() => {});
    }
    // Init animations after splash fades out
    setTimeout(() => this.initAnimations(), 400);
  }

  toggleMusic(): void {
    if (!this.audio) return;
    if (this.isMusicPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
    this.isMusicPlaying = !this.isMusicPlaying;
  }

  /** Pre-load audio so it's ready to play instantly on user tap */
  private prepareMusic(): void {
    const randomIndex = Math.floor(Math.random() * this.musicTracks.length);
    this.audio = new Audio(this.musicTracks[randomIndex]);
    this.audio.volume = this.MUSIC_VOLUME;
    this.audio.loop = true;
    this.audio.preload = 'auto';
    // Preload the audio buffer
    this.audio.load();
  }

  private loadFonts(): void {
    if (this.fontsLoaded) return;
    const link = this.renderer.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap';
    this.renderer.appendChild(document.head, link);
    this.fontsLoaded = true;
  }

  private createStars(): void {
    const invitation = this.el.nativeElement.querySelector('.invitation-section');
    if (!invitation) return;

    for (let i = 0; i < 40; i++) {
      const star = this.renderer.createElement('div');
      this.renderer.addClass(star, 'star');
      const size = Math.random() * 4 + 2;
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const delay = Math.random() * 3;
      const duration = Math.random() * 2 + 1.5;

      this.renderer.setStyle(star, 'width', `${size}px`);
      this.renderer.setStyle(star, 'height', `${size}px`);
      this.renderer.setStyle(star, 'left', `${x}%`);
      this.renderer.setStyle(star, 'top', `${y}%`);
      this.renderer.setStyle(star, 'animationDelay', `${delay}s`);
      this.renderer.setStyle(star, 'animationDuration', `${duration}s`);
      this.renderer.appendChild(invitation, star);
    }
  }

  private initAnimations(): void {
    // Invitation section — staggered entrance for each element
    const invitationElements = [
      '.title-script',
      '.title-sub',
      '.photo-frame',
      '.child-name',
      '.turning-text',
      '.age-number',
      '.tagline',
      '.event-details',
    ];

    invitationElements.forEach((selector, i) => {
      gsap.from(selector, {
        opacity: 0,
        y: 25,
        duration: 0.8,
        delay: 0.2 + i * 0.15,
        ease: 'power2.out',
      });
    });

    // Rundown timeline items — use CSS class toggle instead of scrub for performance
    const timelineItems = gsap.utils.toArray('.timeline-item') as HTMLElement[];
    timelineItems.forEach((item) => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 88%',
        onEnter: () => item.classList.add('is-visible'),
        onLeaveBack: () => item.classList.remove('is-visible'),
      });
    });

    // Parallax background for rundown section
    const rundownBg = this.el.nativeElement.querySelector('.rundown-bg');
    if (rundownBg) {
      gsap.to(rundownBg, {
        scrollTrigger: {
          trigger: '.rundown-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
        y: -100,
        ease: 'none',
      });
    }

    // Notes section
    const noteItems = gsap.utils.toArray('.note-item') as HTMLElement[];
    noteItems.forEach((item, i) => {
      gsap.from(item, {
        scrollTrigger: {
          trigger: item,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        y: 30,
        duration: 0.6,
        delay: i * 0.1,
      });
    });

    // Collage section (family variant) — staggered reveal per cell
    const collageCells = gsap.utils.toArray('.collage-cell') as HTMLElement[];
    collageCells.forEach((cell, i) => {
      gsap.from(cell, {
        scrollTrigger: {
          trigger: cell,
          start: 'top 92%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        scale: 0.92,
        duration: 0.55,
        delay: i * 0.06,
        ease: 'power2.out',
      });
    });
  }
}
