import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => p.url().startsWith('http://127.0.0.1:1420'));
assert(page, 'Start the development desktop app and run smoke-native.mjs --fixtures first.');
try {
  const precision = await page.evaluate(async () => {
    const w = window.__AYORI_WORKSPACE__,
      r = w.renderer,
      norm = r.norm16;
    r.norm16 = null;
    await w.loadScene(0, true);
    const result = {
      fallback: w.fallback,
      depth: w.frames[3].depth,
      firstSample: w.frames[3].pixels[0],
      glError: r.gl.getError(),
    };
    r.norm16 = norm;
    await w.loadScene(2, true);
    return result;
  });
  assert.equal(precision.fallback, true);
  assert.equal(precision.depth, 16);
  assert.equal(precision.firstSample, 772);
  assert.equal(precision.glError, 0);
  const before = await page.evaluate(() => {
    const w = window.__AYORI_WORKSPACE__;
    w.setMode(3);
    w.setZoom(2);
    w.renderer.view.pan = { x: -23, y: 31 };
    return {
      sample: w.frames[0].pixels[0],
      mode: w.mode,
      zoom: w.zoom,
      pan: { ...w.renderer.view.pan },
    };
  });
  const path = resolve('local-fixtures/Reference/00003.png');
  const original = await readFile(path),
    replacement = await readFile(resolve('local-fixtures/Reference/00001.png'));
  try {
    await writeFile(path + '.replacement', replacement);
    await rename(path + '.replacement', path);
    await page.waitForFunction(
      (expected) => window.__AYORI_WORKSPACE__.frames[0]?.pixels[0] === expected,
      3,
      { timeout: 15000 },
    );
    const after = await page.evaluate(() => {
      const w = window.__AYORI_WORKSPACE__;
      return {
        sample: w.frames[0].pixels[0],
        mode: w.mode,
        zoom: w.zoom,
        pan: { ...w.renderer.view.pan },
      };
    });
    assert.equal(after.sample, 3);
    assert.equal(after.mode, before.mode);
    assert.equal(after.zoom, before.zoom);
    assert.deepEqual(after.pan, before.pan);
    console.log(
      JSON.stringify({ forcedFallback: precision, hotReload: { before, after } }, null, 2),
    );
  } finally {
    await writeFile(path, original);
  }
  const clipboard = await page.evaluate(async () => {
    const w = window.__AYORI_WORKSPACE__;
    await w.copy();
    return w.message;
  });
  assert.equal(clipboard, 'Comparison image copied.');
  console.log(JSON.stringify({ clipboard }));
} finally {
  await browser.close();
}

const offlineBrowser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const offline = await offlineBrowser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [],
    network = [];
  offline.on('pageerror', (e) => errors.push(e.message));
  offline.on('request', (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await offline.context().setOffline(true);
  await offline.goto(new URL('../local-fixtures/comparison.html', import.meta.url).href);
  await offline.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('exact'),
  );
  assert.equal(await offline.locator('#scenes option').count(), 3);
  assert.equal(await offline.locator('#sources button').count(), 4);
  await offline.locator('#scenes').selectOption('1');
  await offline.waitForFunction(() => document.querySelectorAll('#sources .missing').length === 1);
  await offline.locator('[data-mode="3"]').click();
  await offline.locator('[data-mode="3"]').click();
  await offline.keyboard.press('g');
  await offline.mouse.move(700, 400);
  await offline.screenshot({ path: 'local-fixtures/offline-verified.png' });
  assert.equal(errors.length, 0);
  assert.equal(network.length, 0);
  console.log(
    JSON.stringify({
      offline: { scenes: 3, sources: 4, sparse: true, errors, networkRequests: network },
    }),
  );
} finally {
  await offlineBrowser.close();
}
