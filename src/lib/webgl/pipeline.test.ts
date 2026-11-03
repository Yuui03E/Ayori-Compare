import { describe, expect, it } from 'vitest';
import { fitView, panelPoint, toUv, zoomAround } from './coordinates';
import { parseFrame, readPixel } from './packet';

function packet(depth = 16) {
  const bytes = new ArrayBuffer(32 + (8 * depth) / 8),
    view = new DataView(bytes);
  [0x49525941, 2, 1, depth, 4, 90, depth, 0].forEach((v, i) => view.setUint32(i * 4, v, true));
  return bytes;
}

describe('source samples', () => {
  it('preserves low 16-bit bits and reads each source in its own resolution', () => {
    const bytes = packet();
    new Uint16Array(bytes, 32).set([257, 258, 65535, 65535, 12345, 42, 0, 65535]);
    const frame = parseFrame(bytes);
    expect(readPixel(frame, { x: 0.1, y: 0.5 })?.samples).toEqual([257, 258, 65535, 65535]);
    expect(readPixel(frame, { x: 0.75, y: 0.5 })?.samples[0]).toBe(12345);
    expect(readPixel(frame, { x: 1, y: 0.5 })).toBeNull();
    expect(readPixel(frame, { x: -0.001, y: 0.5 })).toBeNull();
  });
  it('rejects malformed packets before allocating textures', () => {
    expect(() => parseFrame(new ArrayBuffer(8))).toThrow('Truncated');
    const bytes = packet();
    new DataView(bytes).setUint32(4, 3, true);
    expect(() => parseFrame(bytes)).toThrow('length');
    new DataView(bytes).setUint32(12, 10, true);
    expect(() => parseFrame(bytes)).toThrow('format');
  });
});

describe('physical viewport coordinates', () => {
  it.each([1, 1.25, 1.5, 2])('keeps the texel under the cursor at DPI %s', (dpr) => {
    const cursor = { x: 420 * dpr, y: 250 * dpr },
      pan = { x: -71, y: 35 };
    const before = toUv(cursor, pan, 1, 2560, 1440);
    const after = toUv(cursor, zoomAround(cursor, pan, 1, 1.25), 1.25, 2560, 1440);
    expect(after.x).toBeCloseTo(before.x, 12);
    expect(after.y).toBeCloseTo(before.y, 12);
  });
  it('maps corresponding split positions to the same point', () => {
    expect(panelPoint({ x: 875, y: 180 }, 1200, true)).toEqual(
      panelPoint({ x: 275, y: 180 }, 1200, true),
    );
    const fit = fitView(1200, 800, 1920, 1080, true);
    expect(fit.zoom * 1920).toBe(600);
  });
});
