import { afterEach, describe, expect, it, vi } from 'vitest';
import { RightButtonGesture, normalizeQuickZoom } from './right-button-gesture';
const point = { x: 100, y: 200 };
function setup(enabled = true) {
  vi.useFakeTimers();
  const hold = vi.fn(),
    doubleClick = vi.fn();
  const gesture = new RightButtonGesture({ enabled: () => enabled, hold, doubleClick });
  const click = (time: number, at = point) => {
    gesture.down(at, time);
    gesture.up(at, time + 40);
  };
  return { gesture, hold, doubleClick, click };
}
afterEach(() => vi.useRealTimers());
describe('right click zoom and held loupe', () => {
  it('pairs four fast clicks into two toggles without flashing the loupe', () => {
    const { click, hold, doubleClick } = setup();
    [0, 130, 260, 390].forEach((t) => click(t));
    expect(doubleClick).toHaveBeenCalledTimes(2);
    expect(doubleClick).toHaveBeenLastCalledWith(point);
    vi.advanceTimersByTime(1000);
    expect(hold).not.toHaveBeenCalled();
  });
  it('does not pair distant or slow clicks', () => {
    const { click, doubleClick } = setup();
    click(0);
    click(600);
    click(730, { x: 120, y: 200 });
    expect(doubleClick).not.toHaveBeenCalled();
  });
  it('holds or drags for the loupe and never counts that release as a click', () => {
    const { gesture, click, hold, doubleClick } = setup();
    gesture.down(point, 0);
    vi.advanceTimersByTime(220);
    expect(hold).toHaveBeenLastCalledWith(true);
    gesture.up(point, 240);
    expect(hold).toHaveBeenLastCalledWith(false);
    click(280);
    expect(doubleClick).not.toHaveBeenCalled();
    gesture.down(point, 350);
    gesture.move({ x: 107, y: 200 });
    expect(hold).toHaveBeenLastCalledWith(true);
    gesture.up({ x: 107, y: 200 }, 400);
    click(450, { x: 107, y: 200 });
    expect(doubleClick).not.toHaveBeenCalled();
  });
  it('cancels delayed holds and pending pairs on blur, capture loss or navigation', () => {
    const { gesture, click, hold, doubleClick } = setup();
    gesture.down(point);
    gesture.cancel();
    vi.advanceTimersByTime(1000);
    expect(hold).not.toHaveBeenCalled();
    click(1000);
    gesture.forgetClicks();
    click(1100);
    expect(doubleClick).not.toHaveBeenCalled();
    gesture.down(point, 1200);
    gesture.forgetClicks();
    gesture.up(point, 1240);
    click(1300);
    expect(doubleClick).not.toHaveBeenCalled();
  });
  it('rejects mouse button chords and preserves immediate hold when disabled', () => {
    const { gesture, click, doubleClick } = setup();
    click(0);
    gesture.down(point, 100);
    gesture.move(point, 3);
    gesture.up(point, 140);
    click(200);
    expect(doubleClick).not.toHaveBeenCalled();
    const disabled = setup(false);
    disabled.gesture.down(point);
    expect(disabled.hold).toHaveBeenLastCalledWith(true);
    disabled.gesture.up(point);
    expect(disabled.hold).toHaveBeenLastCalledWith(false);
    expect(disabled.doubleClick).not.toHaveBeenCalled();
  });
  it('validates stored zoom targets before applying them to coordinates', () => {
    expect(normalizeQuickZoom(NaN)).toBe(200);
    expect(normalizeQuickZoom('400')).toBe(200);
    expect(normalizeQuickZoom(-3)).toBe(1);
    expect(normalizeQuickZoom(1e6)).toBe(12800);
    expect(normalizeQuickZoom(375)).toBe(375);
  });
});
