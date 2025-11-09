# 🧭 Developer Notes — Landing Page Revamp (Angular)

This document provides technical guidance for contributors and Copilot Agents working on the **Landing Page Revamp** for [martinharyanto.netlify.app](https://martinharyanto.netlify.app/).  
The goal is to replicate the **smooth, full-screen, parallax experience** of [nickvelten.nl](https://www.nickvelten.nl/) while preserving Angular maintainability and performance.

---

## 🧱 Project Overview

- **Framework:** Angular  
- **Styling:** SCSS  
- **Animation:** GSAP or IntersectionObserver-based motion  
- **Deployment:** Netlify  
- **Goal:** Modern, minimalist, single-page scroll-snap landing page  

This is a **revamp of the existing landing page**, not a full rebuild.

---

## 📁 Folder Structure

All landing-page code should live in a modular section-based structure:

```bash
src/app/
└── sections/
    ├── hero/
    │   ├── hero.component.ts
    │   ├── hero.component.html
    │   ├── hero.component.scss
    │   └── index.ts
    ├── about/
    ├── experience/
    ├── projects/
    └── contact/
```


### ✅ Naming Convention
- Folder names = lowercase, kebab-case (e.g., `case-studies`)
- Component names = PascalCase (e.g., `CaseStudiesComponent`)
- File names = consistent: `section-name.component.ts|html|scss`
- Test files (optional): `section-name.component.spec.ts`

---

## ⚙️ Section Configuration

Sections are rendered dynamically based on an **ordered array** (for flexibility and easy maintenance).

```ts
// src/app/sections/section.config.ts
import { HeroComponent } from './hero/hero.component';
import { AboutComponent } from './about/about.component';

export const SECTION_ORDER = [
  HeroComponent,
  AboutComponent,
  // add more...
];
