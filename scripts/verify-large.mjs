import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('http://127.0.0.1:1420'));
  assert(page, 'Use the development frontend in native WebView2.');
  const result = await page.evaluate(async () => {
    const w = window.__AYORI_WORKSPACE__,
      r = w.renderer;
    r.clear();
    let sourceBytes = 0;
    for (let slot = 0; slot < 8; slot++) {
      const [width, height] = slot % 2 ? [2160, 3840] : [3840, 2160];
      const depth = slot < 4 ? 8 : 16;
      const pixels =
        depth === 8 ? new Uint8Array(width * height * 4) : new Uint16Array(width * height * 4);
      pixels.fill(slot + 3);
      for (let i = 3; i < pixels.length; i += 4) pixels[i] = depth === 8 ? 255 : 65535;
      sourceBytes += pixels.byteLength;
      r.upload(slot, { width, height, depth, originalDepth: depth, fileSize: 0, pixels });
    }
    const present = r.frames.filter(Boolean).length;
    Object.assign(r.view, { slotA: 7, slotB: 1, mode: 3, subMode: 0, loupe: false, grid: false });
    r.fit();
    r.draw();
    const lastSample = r.frames[7].pixels[0],
      glError = r.gl.getError();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    r.clear();
    const cleared = {
      frames: r.frames.filter(Boolean).length,
      textures: r.textures.filter(Boolean).length,
    };
    if (w.matrix) await w.loadScene(0, true);
    return { sourceBytes, present, lastSample, base: [3840, 3840], glError, cleared };
  });
  assert.equal(result.present, 8);
  assert.equal(result.lastSample, 10);
  assert.equal(result.glError, 0);
  assert.deepEqual(result.cleared, { frames: 0, textures: 0 });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
