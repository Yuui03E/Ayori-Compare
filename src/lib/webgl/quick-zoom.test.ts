import { afterEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from './renderer';
import { panelPoint, toUv } from './coordinates';

function setup(split = false, dpr = 1) {
  vi.stubGlobal('window', { devicePixelRatio: dpr });
  const renderer: Renderer = Object.assign(Object.create(Renderer.prototype), {
    canvas: {
      width: 1200 * dpr,
      height: 800 * dpr,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
    },
    view: { zoom: 0.6, pan: { x: 35 * dpr, y: 70 * dpr }, mode: split ? 2 : 0 },
    base: { width: 1920, height: 1080 },
    fitLocked: false,
    sceneSize: null,
    quickZoomReturn: null,
    invalidate: vi.fn(),
    frames: [],
    textures: [],
    fallback: [],
  });
  return renderer;
}
afterEach(() => vi.unstubAllGlobals());
describe('reversible zoom coordinates', () => {
  it.each([1, 1.25, 1.5, 2])(
    'anchors the clicked source coordinate and restores pan at DPI %s',
    (dpr) => {
      const r = setup(true, dpr),
        original = { zoom: r.view.zoom, pan: { ...r.view.pan } };
      const cursor = r.point({ clientX: 850, clientY: 300 });
      const local = panelPoint(cursor, r.canvas.width, true);
      const uv = toUv(local, r.view.pan, r.view.zoom, r.base.width, r.base.height);
      r.toggleQuickZoom(3.75, cursor);
      expect(r.view.zoom).toBe(3.75);
      const zoomed = toUv(local, r.view.pan, r.view.zoom, r.base.width, r.base.height);
      expect(zoomed.x).toBeCloseTo(uv.x, 12);
      expect(zoomed.y).toBeCloseTo(uv.y, 12);
      r.panBy({ x: 40, y: -25 });
      r.toggleQuickZoom(3.75, { x: 100, y: 100 });
      expect({ zoom: r.view.zoom, pan: r.view.pan }).toEqual(original);
    },
  );
  it('restores fit behavior, but does not restore stale viewports after explicit zoom or scene/layout changes', () => {
    const r = setup();
    r.fit();
    const fit = { zoom: r.view.zoom, pan: { ...r.view.pan } };
    r.toggleQuickZoom(2, { x: 200, y: 200 });
    r.toggleQuickZoom(2, { x: 200, y: 200 });
    expect({ zoom: r.view.zoom, pan: r.view.pan }).toEqual(fit);
    expect(Reflect.get(r, 'fitLocked')).toBe(true);
    for (const change of [
      () => r.zoomTo(1),
      () => r.fit(),
      () => r.clear(),
      () => r.setSceneSize(2560, 1440),
      () => r.setMode(2, 0),
    ]) {
      r.toggleQuickZoom(2, { x: 100, y: 100 });
      change();
      r.toggleQuickZoom(4, { x: 100, y: 100 });
      expect(r.view.zoom).toBe(4);
      r.zoomTo(1);
    }
  });
});
