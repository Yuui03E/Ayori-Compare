import type { Point } from './types';

const HOLD_MS = 220;
const DOUBLE_MS = 500;
const SLOP = 6; // CSS pixels, independent of display scaling.

/** Separates quick right clicks from the existing held/dragged dual loupe. */
export class RightButtonGesture {
  private press: { point: Point; time: number; click: boolean } | null = null;
  private last: { point: Point; time: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private holding = false;
  constructor(
    private readonly callbacks: {
      enabled: () => boolean;
      hold: (active: boolean) => void;
      doubleClick: (point: Point) => void;
    },
  ) {}
  get pressed() {
    return this.press !== null;
  }
  down(point: Point, time = performance.now()) {
    if (this.press) this.cancel();
    this.press = { point: { ...point }, time, click: this.callbacks.enabled() };
    if (!this.callbacks.enabled()) this.startHold();
    else this.timer = setTimeout(() => this.startHold(), HOLD_MS);
  }
  move(point: Point, buttons = 2) {
    if (!this.press) return;
    if (buttons !== 2) this.cancel();
    else if (Math.hypot(point.x - this.press.point.x, point.y - this.press.point.y) > SLOP)
      this.startHold();
  }
  up(point: Point, time = performance.now()) {
    const press = this.press;
    if (!press) return;
    clearTimeout(this.timer);
    this.press = null;
    const click =
      press.click &&
      !this.holding &&
      time - press.time < HOLD_MS &&
      Math.hypot(point.x - press.point.x, point.y - press.point.y) <= SLOP;
    if (this.holding) this.callbacks.hold(false);
    this.holding = false;
    if (!click) {
      this.last = null;
      return;
    }
    if (
      this.last &&
      time - this.last.time <= DOUBLE_MS &&
      Math.hypot(point.x - this.last.point.x, point.y - this.last.point.y) <= SLOP
    ) {
      this.last = null;
      this.callbacks.doubleClick({ ...point });
    } else this.last = { point: { ...point }, time };
  }
  /** Interrupt click sequences without ending a loupe held while switching sources. */
  forgetClicks() {
    this.last = null;
    if (this.press) this.press.click = false;
  }
  cancel() {
    clearTimeout(this.timer);
    this.press = null;
    this.last = null;
    if (this.holding) this.callbacks.hold(false);
    this.holding = false;
  }
  private startHold() {
    clearTimeout(this.timer);
    if (!this.press) return;
    this.forgetClicks();
    if (!this.holding) this.callbacks.hold(true);
    this.holding = true;
  }
}

export const normalizeQuickZoom = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(12800, Math.round(value)))
    : 200;
