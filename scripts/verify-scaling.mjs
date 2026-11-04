import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('http://127.0.0.1:1420'));
  assert(page, 'Use the development frontend in native WebView2.');
  const cdp = await page.context().newCDPSession(page);
  const results = [];
  try {
    for (const scale of [1, 1.25, 1.5, 2]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1100,
        height: 720,
        deviceScaleFactor: scale,
        mobile: false,
      });
      const result = await page.evaluate(async () => {
        const w = window.__AYORI_WORKSPACE__,
          r = w.renderer;
        r.clear();
        r.resize();
        const make = (width, height) => {
          const pixels = new Uint8Array(width * height * 4);
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++)
              pixels.set([x % 256, y % 256, (x + y) % 256, 255], (y * width + x) * 4);
          return { width, height, depth: 8, originalDepth: 8, fileSize: 0, pixels };
        };
        r.upload(0, make(1536, 768));
        r.upload(1, make(768, 1536));
        Object.assign(r.view, {
          mode: 0,
          subMode: 0,
          slotA: 0,
          slotB: 1,
          zoom: 1,
          pan: { x: 0, y: 0 },
          grid: false,
          loupe: false,
          filter: 'nearest',
        });
        r.draw();
        const actual = new Uint8Array(4);
        r.gl.readPixels(64, r.canvas.height - 65, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, actual);
        const uv = r.uv({ x: 64.5, y: 64.5 });
        const f = r.frames[0],
          x = Math.floor(uv.x * f.width),
          y = Math.floor(uv.y * f.height);
        const expected = [...f.pixels.slice((y * f.width + x) * 4, (y * f.width + x) * 4 + 4)];
        const point = r.point({ clientX: 100, clientY: 80 });
        r.view.mode = 2;
        r.draw();
        const left = new Uint8Array(4),
          right = new Uint8Array(4);
        r.view.slotB = 0;
        r.draw();
        r.gl.readPixels(30, r.canvas.height - 41, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, left);
        r.gl.readPixels(
          Math.floor(r.canvas.width / 2) + 30,
          r.canvas.height - 41,
          1,
          1,
          r.gl.RGBA,
          r.gl.UNSIGNED_BYTE,
          right,
        );
        return {
          dpr: devicePixelRatio,
          canvas: [r.canvas.width, r.canvas.height],
          point,
          actual: [...actual],
          expected,
          splitLeft: [...left],
          splitRight: [...right],
          glError: r.gl.getError(),
        };
      });
      assert.equal(result.dpr, scale);
      assert.deepEqual(result.canvas, [Math.round(1100 * scale), Math.round(720 * scale)]);
      assert.deepEqual(result.actual, result.expected);
      assert.deepEqual(result.splitLeft, result.splitRight);
      assert.equal(result.point.x, 100 * scale);
      assert.equal(result.point.y, 80 * scale);
      assert.equal(result.glError, 0);
      results.push(result);
    }
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.detach();
    await page.reload();
  }
  console.log(
    JSON.stringify(
      {
        note: 'Emulated device scaling in actual WebView2; not physical mixed-monitor verification',
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
