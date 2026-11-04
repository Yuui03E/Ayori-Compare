import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('http://127.0.0.1:1420'));
  assert(page, 'Use the native app with development frontend.');
  const paths = ['WEB-DL', 'Encode'].map((p) => resolve('local-fixtures/user-comparison', p));
  await page.evaluate(async (paths) => {
    await window.__AYORI_WORKSPACE__.importPaths(paths);
  }, paths);
  const scenes = [];
  for (let i = 0; i < 4; i++) {
    await page.evaluate(async (i) => {
      await window.__AYORI_WORKSPACE__.loadScene(i, true);
    }, i);
    await page.waitForFunction(
      () => Object.keys(window.__AYORI_WORKSPACE__.scores).length === 1,
      null,
      { timeout: 60000 },
    );
    const result = await page.evaluate(() => {
      const w = window.__AYORI_WORKSPACE__,
        r = w.renderer;
      Object.assign(r.view, {
        mode: 0,
        slotA: 0,
        zoom: 1,
        pan: { x: 0, y: 0 },
        grid: false,
        loupe: false,
      });
      r.draw();
      const actual = new Uint8Array(4);
      r.gl.readPixels(200, r.canvas.height - 201, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, actual);
      const f = w.frames[0];
      const expected = [
        ...f.pixels.slice((200 * f.width + 200) * 4, (200 * f.width + 200) * 4 + 4),
      ];
      r.fit();
      return {
        scene: w.sceneIndex,
        dimensions: w.frames.filter(Boolean).map((f) => [f.width, f.height]),
        scores: JSON.parse(JSON.stringify(w.scores)),
        errors: w.errors,
        actual: [...actual],
        expected,
      };
    });
    assert.deepEqual(result.errors, {});
    assert.deepEqual(result.actual, result.expected);
    assert(Number.isFinite(result.scores[1].score));
    scenes.push(result);
  }
  const ownership = await page.evaluate(async () => {
    const w = window.__AYORI_WORKSPACE__,
      r = w.renderer,
      gl = r.gl;
    const create = gl.createTexture.bind(gl),
      remove = gl.deleteTexture.bind(gl);
    let created = 0,
      deleted = 0;
    gl.createTexture = (...args) => {
      created++;
      return create(...args);
    };
    gl.deleteTexture = (texture) => {
      if (texture) deleted++;
      return remove(texture);
    };
    try {
      for (let i = 0; i < 24; i++) {
        await w.loadScene(i % 4);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return {
        created,
        deleted,
        remaining: r.frames.filter(Boolean).length,
        glError: gl.getError(),
      };
    } finally {
      gl.createTexture = create;
      gl.deleteTexture = remove;
    }
  });
  assert.equal(ownership.created, ownership.deleted);
  assert.equal(ownership.remaining, 2);
  assert.equal(ownership.glError, 0);
  console.log(JSON.stringify({ scenes, ownership }, null, 2));
} finally {
  await browser.close();
}
