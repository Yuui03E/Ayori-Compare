import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Start a development WebView2 instance with remote debugging on localhost:9223.
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('http://127.0.0.1:1420'));
  assert(page, 'The development desktop app must be running.');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await page.getByRole('button', { name: 'Explore a sample comparison' }).click();
  await page.getByText('SAMPLE COMPARISON', { exact: true }).waitFor();
  const result = await page.evaluate(async () => {
    const w = window.__AYORI_WORKSPACE__;
    const r = w.renderer,
      gl = r.gl;
    const original = { ...r.view, pan: { ...r.view.pan } };
    r.view.mode = 0;
    r.view.subMode = 0;
    r.view.slotA = 0;
    r.view.zoom = 1;
    r.view.pan = { x: 0, y: 0 };
    r.view.grid = false;
    r.draw();
    const actual = new Uint8Array(4);
    gl.readPixels(64, r.canvas.height - 65, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, actual);
    const expected = Array.from(
      r.frames[0].pixels.slice(
        (64 * r.frames[0].width + 64) * 4,
        (64 * r.frames[0].width + 64) * 4 + 4,
      ),
    );
    r.view.mode = 3;
    r.view.subMode = 0;
    r.view.slotA = 0;
    r.view.slotB = 0;
    r.draw();
    const difference = new Uint8Array(4);
    gl.readPixels(64, r.canvas.height - 65, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, difference);
    r.view.subMode = 1;
    r.draw();
    const heatmap = new Uint8Array(4);
    gl.readPixels(64, r.canvas.height - 65, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, heatmap);
    for (let mode = 0; mode < 5; mode++)
      for (let sub = 0; sub < [1, 3, 1, 2, 4][mode]; sub++) {
        r.view.mode = mode;
        r.view.subMode = sub;
        r.view.slotB = 1;
        r.view.mouse = { x: 200, y: 200 };
        r.view.loupe = true;
        r.view.grid = true;
        r.draw();
      }
    const glError = gl.getError();
    Object.assign(r.view, original);
    r.view.loupe = false;
    r.view.grid = false;
    r.fit();
    const durations = [];
    for (let i = 0; i < 300; i++) {
      const start = performance.now();
      w.select(i % 4);
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    w.select(0);
    return {
      actual: Array.from(actual),
      expected,
      difference: Array.from(difference),
      heatmap: Array.from(heatmap),
      glError,
      norm16: !!r.norm16,
      frameDepths: r.frames.filter(Boolean).map((f) => f.depth),
      switchMedianMs: durations[150],
      switchP95Ms: durations[285],
    };
  });
  assert.deepEqual(result.actual, result.expected, '100% nearest pixels must match the source');
  assert.deepEqual(result.difference, [0, 0, 0, 255], 'Identical RGB difference must be black');
  assert.deepEqual(result.heatmap, [0, 0, 0, 255], 'Identical luma heatmap must be black');
  assert.equal(result.glError, 0, 'All shader modes must render without GL errors');
  assert.deepEqual(result.frameDepths, [8, 8, 8, 16]);
  await page.keyboard.press('2');
  await page.keyboard.press('Space');
  const slot = await page.evaluate(async () => {
    const w = window.__AYORI_WORKSPACE__;
    return w.slotA;
  });
  assert.equal(slot, 0, 'Space returns to the previously selected source');
  await page.keyboard.press('h');
  assert(await page.locator('.hud').evaluate((el) => el.classList.contains('hidden')));
  await page.keyboard.press('h');
  await page.keyboard.press('g');
  await page.mouse.move(700, 400);
  await mkdir('local-fixtures', { recursive: true });
  await page.screenshot({ path: 'local-fixtures/native-demo.png' });
  assert.deepEqual(errors, [], 'No uncaught frontend errors');
  console.log(JSON.stringify({ nativeRenderer: result, frontendErrors: errors }, null, 2));

  if (process.argv.includes('--fixtures')) {
    const root = resolve('local-fixtures');
    const imported = await page.evaluate(async (root) => {
      const w = window.__AYORI_WORKSPACE__;
      await w.importPaths(
        ['Reference', 'Grain', 'Quantized', 'High-depth'].map((p) => root + '/' + p),
      );
      return {
        scenes: w.matrix.scenes.length,
        depths: w.frames.filter(Boolean).map((f) => f.depth),
        errors: w.errors,
        loadMs: w.loadMs,
      };
    }, root);
    assert.equal(imported.scenes, 3);
    assert.deepEqual(imported.depths, [8, 8, 8, 16]);
    assert.deepEqual(imported.errors, {});
    await page.waitForFunction(
      () => {
        const w = window.__AYORI_WORKSPACE__;
        return Object.keys(w.scores).length === 3;
      },
      {},
      { timeout: 60000 },
    );
    const metrics = await page.evaluate(async () => {
      const w = window.__AYORI_WORKSPACE__;
      return JSON.parse(JSON.stringify(w.scores));
    });
    assert.equal(Object.keys(metrics).length, 3);
    assert(
      Object.values(metrics).every((m) => Number.isFinite(m.score)),
      JSON.stringify(metrics),
    );
    const sparse = await page.evaluate(async () => {
      const w = window.__AYORI_WORKSPACE__;
      await w.loadScene(1);
      return w.frames.map((f) => !!f);
    });
    assert.deepEqual(sparse, [true, true, true, false, false, false, false, false]);
    const race = await page.evaluate(async () => {
      const w = window.__AYORI_WORKSPACE__;
      await Promise.all([w.loadScene(0), w.loadScene(1), w.loadScene(2)]);
      return { scene: w.sceneIndex, count: w.frames.filter(Boolean).length, errors: w.errors };
    });
    assert.equal(race.scene, 2);
    assert.equal(race.count, 4);
    assert.deepEqual(race.errors, {});
    await page.evaluate(async (path) => {
      const { invoke } = await import('/node_modules/@tauri-apps/api/core.js');
      await invoke('export_html', { path });
    }, resolve('local-fixtures/comparison.html'));
    console.log(
      JSON.stringify(
        { imported, metrics, sparse, race, export: 'local-fixtures/comparison.html' },
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
