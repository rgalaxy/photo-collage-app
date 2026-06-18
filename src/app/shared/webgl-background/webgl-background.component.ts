import {
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  AfterViewInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Signature interactive backdrop for the "Interactive Dev Playground".
 *
 * A single full-screen fragment shader paints a flowing violet -> cyan -> coral
 * nebula (domain-warped value noise) and drags a glowing metaball toward the
 * pointer / touch. Hand-written WebGL — no library, so the bundle cost is a few
 * hundred bytes of GLSL.
 *
 * Safe by default:
 *  - WebGL missing            -> falls back to a CSS gradient, no error.
 *  - prefers-reduced-motion   -> renders ONE static frame, no animation loop.
 *  - tab hidden / off-screen  -> render loop is paused (battery friendly).
 *  - coarse pointer (mobile)  -> lower pixel ratio for 60fps headroom.
 *  - runs outside Angular zone -> never triggers change detection.
 */
@Component({
  selector: 'app-webgl-bg',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        overflow: hidden;
        /* Fallback if WebGL is unavailable or before first paint */
        background:
          radial-gradient(120% 120% at 20% 10%, rgba(124, 58, 237, 0.55), transparent 55%),
          radial-gradient(120% 120% at 85% 80%, rgba(251, 113, 133, 0.45), transparent 55%),
          radial-gradient(100% 100% at 60% 50%, rgba(34, 211, 238, 0.35), transparent 60%),
          #07070d;
      }
      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class WebglBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** Overall brightness of the nebula (0..1.4). */
  @Input() intensity = 1;
  /** Whether the glow follows the pointer. */
  @Input() interactive = true;

  /** Per-section palette emphasis. Changing it eases the colours over ~0.8s. */
  @Input() set paletteShift(v: number) {
    this.targetShift = v;
  }
  /** 1 = dark surfaces, 0 = light surfaces. */
  @Input() set dark(v: boolean) {
    this.uDarkTarget = v ? 1 : 0;
  }

  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);

  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private raf = 0;
  private startTime = 0;
  private running = false;
  private disposed = false;

  // animated state
  private targetShift = 0;
  private curShift = 0;
  private uDarkTarget = 1;
  private uDarkCur = 1;
  private pointer = { x: 0.5, y: 0.5 };
  private pointerTarget = { x: 0.5, y: 0.5 };
  private pointerAmt = 0.35;
  private pointerAmtTarget = 0.35;

  // uniform locations
  private uRes: WebGLUniformLocation | null = null;
  private uTime: WebGLUniformLocation | null = null;
  private uPointer: WebGLUniformLocation | null = null;
  private uPointerAmt: WebGLUniformLocation | null = null;
  private uShift: WebGLUniformLocation | null = null;
  private uIntensity: WebGLUniformLocation | null = null;
  private uDarkLoc: WebGLUniformLocation | null = null;

  private resizeObs?: ResizeObserver;
  private intersectObs?: IntersectionObserver;
  private reducedMotion = false;
  private dpr = 1;

  private onPointerMove = (e: PointerEvent | MouseEvent) => {
    if (!this.interactive) return;
    const x = (e as PointerEvent).clientX;
    const y = (e as PointerEvent).clientY;
    this.pointerTarget.x = x / window.innerWidth;
    this.pointerTarget.y = 1 - y / window.innerHeight;
    this.pointerAmtTarget = 1;
  };
  private onTouchMove = (e: TouchEvent) => {
    if (!this.interactive || !e.touches.length) return;
    const t = e.touches[0];
    this.pointerTarget.x = t.clientX / window.innerWidth;
    this.pointerTarget.y = 1 - t.clientY / window.innerHeight;
    this.pointerAmtTarget = 1;
  };
  private onVisibility = () => {
    if (document.hidden) this.stop();
    else if (!this.reducedMotion) this.start();
  };

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.6);

    if (!this.initGL()) {
      // CSS gradient fallback already on :host — just bail quietly.
      return;
    }

    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.canvasRef.nativeElement);

    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      window.addEventListener('touchmove', this.onTouchMove, { passive: true });
      document.addEventListener('visibilitychange', this.onVisibility);

      if (this.reducedMotion) {
        // Single static frame — accessible + cheap.
        this.renderFrame(6.0);
      } else {
        // Only animate while on-screen.
        this.intersectObs = new IntersectionObserver(
          entries => {
            const visible = entries.some(en => en.isIntersecting);
            if (visible && !document.hidden) this.start();
            else this.stop();
          },
          { threshold: 0 }
        );
        this.intersectObs.observe(this.canvasRef.nativeElement);
        this.start();
      }
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.stop();
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('touchmove', this.onTouchMove);
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.resizeObs?.disconnect();
    this.intersectObs?.disconnect();
    const gl = this.gl;
    if (gl) {
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    }
    this.gl = null;
    this.program = null;
  }

  private start(): void {
    if (this.running || this.disposed || this.reducedMotion) return;
    this.running = true;
    if (!this.startTime) this.startTime = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.renderFrame((now - this.startTime) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private resize(): void {
    const gl = this.gl;
    const canvas = this.canvasRef.nativeElement;
    if (!gl || !canvas) return;
    const w = Math.max(1, Math.floor(canvas.clientWidth * this.dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * this.dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    if (this.reducedMotion) this.renderFrame(6.0);
  }

  private renderFrame(time: number): void {
    const gl = this.gl;
    if (!gl || !this.program) return;

    // ease state toward targets (frame-rate independent enough for visuals)
    const k = 0.08;
    this.curShift += (this.targetShift - this.curShift) * k;
    this.uDarkCur += (this.uDarkTarget - this.uDarkCur) * k;
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.06;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.06;
    // glow swells on movement then relaxes to a calm baseline
    this.pointerAmtTarget += (0.35 - this.pointerAmtTarget) * 0.02;
    this.pointerAmt += (this.pointerAmtTarget - this.pointerAmt) * 0.05;

    gl.uniform2f(this.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(this.uTime, time);
    gl.uniform2f(this.uPointer, this.pointer.x, this.pointer.y);
    gl.uniform1f(this.uPointerAmt, this.interactive ? this.pointerAmt : 0);
    gl.uniform1f(this.uShift, this.curShift);
    gl.uniform1f(this.uIntensity, this.intensity);
    gl.uniform1f(this.uDarkLoc, this.uDarkCur);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private initGL(): boolean {
    const canvas = this.canvasRef.nativeElement;
    const opts: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    };
    const gl =
      (canvas.getContext('webgl', opts) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl', opts) as WebGLRenderingContext | null);
    if (!gl) return false;
    this.gl = gl;

    const vs = this.compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return false;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return false;
    }
    gl.useProgram(program);
    this.program = program;

    // Full-screen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.uRes = gl.getUniformLocation(program, 'uRes');
    this.uTime = gl.getUniformLocation(program, 'uTime');
    this.uPointer = gl.getUniformLocation(program, 'uPointer');
    this.uPointerAmt = gl.getUniformLocation(program, 'uPointerAmt');
    this.uShift = gl.getUniformLocation(program, 'uShift');
    this.uIntensity = gl.getUniformLocation(program, 'uIntensity');
    this.uDarkLoc = gl.getUniformLocation(program, 'uDark');
    return true;
  }

  private compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }
}

const VERT_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uPointer;
uniform float uPointerAmt;
uniform float uShift;
uniform float uIntensity;
uniform float uDark;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * 1.6;

  float t = uTime * 0.06 + uShift * 0.6;

  // domain warp for a flowing, liquid feel
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.15 * t),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.12 * t)
  );
  float f = fbm(p + 2.2 * r);

  // brand palette: violet -> indigo -> cyan -> coral
  vec3 violet = vec3(0.486, 0.227, 0.929);
  vec3 indigo = vec3(0.357, 0.357, 0.961);
  vec3 cyan   = vec3(0.133, 0.827, 0.933);
  vec3 coral  = vec3(0.984, 0.443, 0.522);

  float m1 = smoothstep(0.15, 0.85, f + 0.18 * sin(uShift * 1.7));
  vec3 col = mix(violet, indigo, m1);
  col = mix(col, cyan, smoothstep(0.3, 0.95, r.x + 0.15 * cos(uShift)));
  col = mix(col, coral, smoothstep(0.55, 1.05, r.y + 0.12 * sin(uShift * 0.9 + 1.0)));

  // pointer-driven glow (metaball)
  vec2 pp = vec2(uPointer.x * aspect, uPointer.y);
  vec2 cc = vec2(uv.x * aspect, uv.y);
  float d = distance(cc, pp);
  float glow = exp(-d * 3.2) * uPointerAmt;
  vec3 glowCol = mix(cyan, coral, 0.5 + 0.5 * sin(uShift + uTime * 0.2));
  col += glow * glowCol * 0.85;

  float lum = smoothstep(0.05, 1.15, f + 0.35 * r.y);

  // dark surface: glowing nebula on near-black
  vec3 darkBase = vec3(0.027, 0.027, 0.05);
  vec3 dark = darkBase + col * (lum * 1.15 + 0.08) * uIntensity + glow * glowCol * 0.4;

  // light surface: soft pastel wash on near-white
  vec3 lightBase = vec3(0.97, 0.97, 0.99);
  vec3 light = mix(lightBase, col, (0.18 + 0.42 * lum) * uIntensity);
  light += glow * glowCol * 0.18;

  col = mix(light, dark, uDark);

  // vignette
  vec2 vd = (uv - 0.5) * vec2(aspect, 1.0);
  float vig = smoothstep(1.25, 0.25, length(vd));
  col *= mix(1.0, vig, 0.45 * uDark + 0.15);

  // dither to kill banding on smooth gradients
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.02;

  gl_FragColor = vec4(col, 1.0);
}
`;
