## 📝 Summary
Revamp the **landing page** of the existing website [martinharyanto.netlify.app](https://martinharyanto.netlify.app/) to match the **UI/UX and scroll behavior** of [nickvelten.nl](https://www.nickvelten.nl/).

> 🎯 Focus on smooth section transitions, parallax effects, and a modern full-screen layout using existing Angular codebase.

---

## 🎯 Objectives
- Rework the **landing page** only (not the entire site).
- Achieve a **modern, immersive one-page portfolio** style.
- Implement **smooth scroll + 100vh sections**.
- Match **scroll behavior and animations** from nickvelten.nl.
- Reuse and reorganize **existing content** from current website.
- Prefill **missing assets or copy** with placeholders.
- Ensure **no JS/TS linting or build errors** after revamp.

---

## 🧱 Tech Stack
| Item | Description |
|------|--------------|
| **Framework** | Angular (existing project) |
| **Styling** | SCSS |
| **Animation** | GSAP or Framer Motion equivalent for Angular |
| **Fonts** | Inter / Poppins (Google Fonts) |
| **Hosting** | Netlify (existing) |
| **Theme** | Single neutral background for light/dark modes |

---

## 📜 Content & Section Structure
Use current site content but enhance layout, order, and presentation.

### Proposed Section Flow:
1. **Hero Section**
   - Full-screen intro (name, title, short description)
   - Subtle parallax or gradient movement
   - “Scroll Down” cue animation
   - Placeholder background allowed

2. **About Section**
   - Short personal summary
   - Placeholder portrait image
   - Text + simple layout

3. **Experience Section**
   - Timeline or card-based layout
   - Company, role, and achievements

4. **Projects Section**
   - Grid or horizontal scroll for featured projects
   - Title, short description, link
   - Placeholder images as needed

5. **Contact Section**
   - Simple “Let’s Connect” CTA
   - Links (email, LinkedIn, GitHub)
   - Footer text or copyright

> 🧩 All placeholder images may use `https://placehold.co/600x400`  
> 🧠 Missing text should use `Lorem ipsum` filler until replaced.

---

## 🎨 Design & Interaction Requirements
- **Scroll snapping**: each section fills full viewport (`100vh`).
- **Smooth scroll** and **fade/slide animations** between sections.
- **Subtle parallax** on hero or background elements.
- **Responsive design**: works well on mobile, tablet, desktop.
- **Semantic HTML**: `<section>`, `<header>`, `<footer>` structure.
- **SEO-Ready**:
  - Only one `<h1>` per page
  - `<meta>` description, keywords, Open Graph tags
  - Proper heading hierarchy
- **Accessibility**:
  - Alt text for images
  - Keyboard-friendly navigation
  - High contrast text

---

## ⚙️ Implementation Notes
- Place all new code under `/src/app/landing` or `/src/app/sections/`
- Each section = **Angular component**
- Section order configurable via array (easy maintenance)
- Use IntersectionObserver or scroll triggers for fade-in effects
- No JS/TS linting or build errors
- Maintain consistent spacing, typography, and SCSS variables

**Example folder structure:**
```bash
src/app/sections/
├── hero/
├── about/
├── experience/
├── projects/
└── contact/
```

---

## 🧠 Behavior (Match from NickVelten.nl)
- Scroll = section snap transitions  
- Smooth parallax on background or text layers  
- Sections fade/slide in/out gracefully  
- Optional scroll progress indicator  
- Stable 60fps performance on all devices  

---

## ✅ Acceptance Criteria
- Layout visually resembles nickvelten.nl in UX smoothness and flow.
- Scroll-snapping, parallax, and fade animations work correctly.
- Responsive and accessible across all screen sizes.
- SEO score ≥ 90 (Lighthouse).
- No TypeScript or linting issues.
- Easy to add/reorder sections.
- Deploys cleanly to Netlify.

---

## 💡 Future Enhancements (Not Required Now)
- Theme switching (dark/light)
- CMS or JSON-based content configuration
- Animated or particle-based background layer

---

## 🧩 References
- Inspiration: [https://www.nickvelten.nl/](https://www.nickvelten.nl/)
- Current Site: [https://martinharyanto.netlify.app/](https://martinharyanto.netlify.app/)
- Placeholder assets: [https://placehold.co/](https://placehold.co/)

---
