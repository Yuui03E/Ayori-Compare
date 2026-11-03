import type { ComparisonMatrix, Frame } from './types';

export const demoMatrix: ComparisonMatrix = {
  sources: [
    { label: 'Reference', origin: 'demo:0', kind: 'file' },
    { label: 'Fine grain', origin: 'demo:1', kind: 'file' },
    { label: 'Quantized', origin: 'demo:2', kind: 'file' },
    { label: '16-bit gradient', origin: 'demo:3', kind: 'file' },
  ],
  scenes: [0, 1, 2].map((i) => ({
    id: `demo:${i}`,
    label: ['Dusk / gradients', 'Edges / detail', 'Shadows / banding'][i],
    frames: [0, 1, 2, 3].map((s) => `demo:${i}:${s}`),
  })),
  warnings: [],
};

export function demoFrame(scene: number, slot: number): Frame {
  const width = 1280,
    height = 720,
    depth = slot === 3 ? 16 : 8;
  const pixels =
    depth === 16 ? new Uint16Array(width * height * 4) : new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / width,
        v = y / height;
      const mountain = 0.56 + Math.sin(u * 7) * 0.06 + Math.sin(u * 23) * 0.025;
      let r = 0.11 + 0.48 * v,
        g = 0.17 + 0.27 * v,
        b = 0.29 + 0.16 * v;
      const sun = Math.hypot((u - 0.72) * width, (v - 0.3) * height) < 61;
      if (sun) {
        r = 0.94;
        g = 0.8;
        b = 0.66;
      }
      if (v > mountain) {
        r = 0.075;
        g = 0.115;
        b = 0.155;
      }
      if (v > 0.71 + Math.sin(u * 13) * 0.035) {
        r = 0.043;
        g = 0.071;
        b = 0.09;
      }
      if (x > 180 && x < 480 && y > 435 && y < 595) {
        r = 0.12;
        g = 0.16;
        b = 0.18;
        if ((x - 190) % 53 < 22 && (y - 442) % 65 < 35) {
          r = 0.73;
          g = 0.63;
          b = 0.4;
        }
      }
      if (scene === 1) {
        const line = Math.abs(x - y * 1.1) % 48 < 2;
        r = line ? 0.85 : 0.08;
        g = line ? 0.85 : 0.12;
        b = line ? 0.82 : 0.17;
      }
      if (scene === 2) {
        r = 0.004 + 0.045 * u;
        g = 0.006 + 0.05 * u;
        b = 0.013 + 0.058 * u;
        if (v > 0.64) {
          r *= 0.35;
          g *= 0.35;
          b *= 0.35;
        }
      }
      const noise = ((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1) * 0.006;
      if (slot === 1) {
        r += noise;
        g += noise;
        b += noise;
      }
      if (slot === 2) {
        r = Math.round(r * 31) / 31;
        g = Math.round(g * 31) / 31;
        b = Math.round(b * 31) / 31;
      }
      const m = depth === 16 ? 65535 : 255,
        i = (y * width + x) * 4;
      pixels[i] = Math.max(0, Math.min(m, Math.round(r * m)));
      pixels[i + 1] = Math.max(0, Math.min(m, Math.round(g * m)));
      pixels[i + 2] = Math.max(0, Math.min(m, Math.round(b * m)));
      pixels[i + 3] = m;
    }
  return { width, height, depth, originalDepth: depth, fileSize: 0, pixels };
}
