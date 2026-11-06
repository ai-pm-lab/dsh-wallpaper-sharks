import { AsciiRenderer, type OceanTheme } from "./renderer";
import { World, type SharkSpec } from "./world";

const STEP = 1 / 60;
const MAX_STEPS = 4;

/**
 * Wires World + AsciiRenderer to a canvas: fixed-timestep loop, resize,
 * pointer input, pausing off-screen, and prefers-reduced-motion.
 */
export class OceanEngine {
  private world: World;
  private renderer: AsciiRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private visible = true;
  private paused = false;
  private pointerEnabled = true;
  private maxDpr = 1.5;
  private frameInterval = 1000 / 30;
  private reducedMotion: MediaQueryList;
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, sharks?: SharkSpec[]) {
    this.world = new World(sharks);
    this.renderer = new AsciiRenderer(canvas);
    this.renderer.setFontFamily(getComputedStyle(canvas).fontFamily);
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.schedule();
    });
    this.intersectionObserver.observe(canvas);

    this.reducedMotion.addEventListener("change", this.onMotionPreference);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("blur", this.onPointerLeave);

    this.resize();
    // Canvas text can't trigger a webfont load; once the mono face is in, redraw.
    document.fonts?.load(`600 16px ${getComputedStyle(canvas).fontFamily}`).then(() => {
      if (!this.disposed && this.reducedMotion.matches) this.drawStill();
    });
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.reducedMotion.removeEventListener("change", this.onMotionPreference);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    document.documentElement.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("blur", this.onPointerLeave);
  }

  /** Stop or resume the simulation. */
  pause(paused = true) {
    this.paused = paused;
    if (paused) cancelAnimationFrame(this.raf);
    else this.schedule();
  }

  /** Whole-canvas opacity, clamped to 0.05–1. */
  setOpacity(value: number) {
    const clamped = Math.min(1, Math.max(0.05, Number.isFinite(value) ? value : 1));
    this.canvas.style.opacity = clamped === 1 ? "" : String(clamped);
  }

  /** Whether the pointer scatters the fish. */
  setPointerEnabled(enabled: boolean) {
    this.pointerEnabled = enabled;
    if (!enabled) this.world.pointer.active = false;
  }

  /** Palette + density; repaints the grid. */
  setTheme(theme: OceanTheme) {
    this.renderer.setTheme(theme);
    if (this.reducedMotion.matches) this.drawStill();
  }

  /** Fixed cell width (plan C: 8px). */
  setCellWidth(width: number) {
    this.renderer.setCellWidth(width);
  }

  /** Global shark size multiplier, 0.4 to 1.8 (1 = design size). */
  setSharkScale(scale: number) {
    this.world.setSizeScale(scale);
  }

  /** Target render FPS (10–60). The rAF still drives the clock; frames are skipped. */
  setFps(fps: number) {
    const clamped = Math.min(60, Math.max(10, Math.round(fps)));
    this.frameInterval = 1000 / clamped;
  }

  /** Device-pixel-ratio cap (1–2). 1.5 is the balanced default; 1 is fastest. */
  setMaxDpr(dpr: number) {
    this.maxDpr = Math.min(2, Math.max(1, dpr));
    this.resize();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
    if (this.reducedMotion.matches) this.drawStill();
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || this.paused || !this.visible || this.reducedMotion.matches) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    if (this.paused) return;
    this.raf = requestAnimationFrame(this.frame);
    if (now - this.last < this.frameInterval - 2) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    this.renderer.render(this.world, dt);
  };

  /** Reduced motion: let the ecosystem settle, then show a single frame. */
  private drawStill() {
    if (this.world.time < 4) {
      for (let i = 0; i < 240; i++) this.world.step(STEP);
    }
    this.renderer.render(this.world, STEP);
  }

  private onMotionPreference = () => {
    if (this.reducedMotion.matches) {
      cancelAnimationFrame(this.raf);
      this.drawStill();
    } else {
      this.schedule();
    }
  };

  /** Hidden tab: stop the loop outright instead of letting rAF throttle it. */
  private onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else this.schedule();
  };

  private toLocal(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    return { x, y, inside };
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerEnabled) return;
    const { x, y, inside } = this.toLocal(e);
    const p = this.world.pointer;
    p.x = x;
    p.y = y;
    p.active = inside && e.pointerType !== "touch";
  };

  private onPointerDown = (e: PointerEvent) => {
    if (!this.pointerEnabled || this.paused) return;
    const { x, y, inside } = this.toLocal(e);
    if (inside && !this.reducedMotion.matches) this.world.splash(x, y);
  };

  private onPointerLeave = () => {
    this.world.pointer.active = false;
  };
}
