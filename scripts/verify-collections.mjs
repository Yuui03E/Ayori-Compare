import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';

// Original generated images. All output stays in ignored local-fixtures.
const root = resolve('local-fixtures/collection-100');
await mkdir(root, { recursive: true });
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(width, height, sample) {
  const chunk = (type, bytes) => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(bytes.length);
    const payload = Buffer.concat([Buffer.from(type), bytes]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload));
    return Buffer.concat([header, payload, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      raw.set([sample, x % 256, y % 256, 255], y * (width * 4 + 1) + 1 + x * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const paths = await Promise.all(
  Array.from({ length: 100 }, async (_, i) => {
    const path = resolve(root, `Release ${i + 1}.png`);
    await writeFile(path, png(i === 99 ? 640 : 512, i === 99 ? 360 : 288, i));
    return path;
  }),
);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().startsWith('http://127.0.0.1:1420'));
  assert(page, 'Launch the development Windows app with debugging on port 9223.');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await page.waitForFunction(() => !!window.__AYORI_WORKSPACE__?.renderer);
  const saved = await page.evaluate(() => [
    localStorage.getItem('ayori.shortcuts.v1'),
    localStorage.getItem('ayori.interface.v1'),
  ]);
  try {
    // Use the editor, verify conflicts, key capture, tooltip content and persistence.
    await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search shortcuts' }).fill('pixel grid');
    await page
      .getByRole('button', { name: 'Edit Pixel grid & readout shortcut', exact: true })
      .click();
    await page.keyboard.press('m');
    await page
      .getByText('Already assigned to “Instant swap”. Clear or change that shortcut first.', {
        exact: true,
      })
      .waitFor();
    await page.keyboard.press('Control+g');
    await page
      .getByRole('button', { name: 'Edit Pixel grid & readout shortcut', exact: true })
      .filter({ hasText: 'Ctrl + G' })
      .waitFor();
    await page.getByRole('textbox', { name: 'Search shortcuts' }).fill('Hold dual');
    await page.getByRole('button', { name: 'Edit Hold dual loupe shortcut', exact: true }).click();
    await page.keyboard.press('Tab');
    await page
      .getByText('Tab is reserved for moving keyboard focus between controls.', { exact: true })
      .waitFor();
    await page.keyboard.press('Escape');
    assert(await page.getByRole('dialog', { name: 'Settings & shortcuts' }).isVisible());
    await page.getByRole('button', { name: 'Edit Hold dual loupe shortcut', exact: true }).click();
    await page.keyboard.press('l');
    await page.getByRole('tab', { name: 'Interface & guidance' }).click();
    await page.getByRole('checkbox', { name: /Auto-hide comparison controls/ }).uncheck();
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('ayori.interface.v1')).autoHide),
      false,
    );
    await page.getByRole('tab', { name: /Keyboard shortcuts/ }).click();
    await page.getByRole('textbox', { name: 'Search shortcuts' }).fill('');
    await page.screenshot({ path: 'local-fixtures/shortcut-settings.png' });
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.reload();
    await page.waitForFunction(() => !!window.__AYORI_WORKSPACE__?.renderer);
    await page.evaluate(async (paths) => {
      await window.__AYORI_WORKSPACE__.importPaths(paths);
    }, paths);
    assert.equal(await page.evaluate(() => window.__AYORI_WORKSPACE__.matrix.sources.length), 100);
    await page.locator('canvas').focus();
    await page.keyboard.press('g');
    assert.equal(await page.evaluate(() => window.__AYORI_WORKSPACE__.grid), false);
    await page.keyboard.down('l');
    assert.equal(await page.evaluate(() => window.__AYORI_WORKSPACE__.renderer.view.loupe), true);
    await page.keyboard.up('l');
    assert.equal(await page.evaluate(() => window.__AYORI_WORKSPACE__.renderer.view.loupe), false);
    await page.keyboard.press('Control+g');
    assert.equal(await page.evaluate(() => window.__AYORI_WORKSPACE__.grid), true);
    await page.keyboard.press('Control+g');
    await page.getByRole('button', { name: 'Pixel grid and readout' }).hover();
    await page
      .locator('#ayori-tooltip')
      .filter({ hasText: 'Ctrl + G' })
      .waitFor({ state: 'visible' });
    await page.screenshot({ path: 'local-fixtures/collection-tooltip.png' });
    await page.getByRole('button', { name: 'Browse sources', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sources' }).fill('Release 100.');
    await page.getByRole('button', { name: 'Set source 100 as A', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sources' }).fill('Release 50.');
    await page.getByRole('button', { name: 'Set source 50 as B', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sources' }).fill('');
    await page.screenshot({ path: 'local-fixtures/collection-browser.png' });
    await page.getByRole('button', { name: 'View comparison', exact: true }).click();
    await page.waitForFunction(() => {
      const w = window.__AYORI_WORKSPACE__;
      return !w.pendingSlots.length && !!w.frames[99] && !!w.frames[49];
    });
    const large = await page.evaluate(async () => {
      const w = window.__AYORI_WORKSPACE__,
        r = w.renderer;
      const invariant = () => {
        if (w.frames.filter(Boolean).length > 8) throw Error('Unbounded source residency');
      };
      const start = { base: { ...r.base }, a: w.frames[99].pixels[0], b: w.frames[49].pixels[0] };
      r.view.mode = 0;
      r.view.slotA = 99;
      r.view.zoom = 1;
      r.view.pan = { x: 0, y: 0 };
      r.view.grid = false;
      r.draw();
      const gpu = new Uint8Array(4);
      r.gl.readPixels(32, r.canvas.height - 33, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, gpu);
      for (const slot of [25, 60, 15, 70, 85, 99]) {
        w.select(slot);
        invariant();
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      while (w.pendingSlots.length) await new Promise((resolve) => setTimeout(resolve, 30));
      invariant();
      const retained = w.frames.filter(Boolean).length;
      w.setMode(1);
      w.setMode(1);
      w.setMode(1);
      while (w.pendingSlots.length) await new Promise((resolve) => setTimeout(resolve, 30));
      const quadrants = w.frames.slice(0, 4).every(Boolean);
      w.setMode(0);
      r.fit();
      return {
        ...start,
        gpu: [...gpu],
        retained,
        quadrants,
        glError: r.gl.getError(),
        baseAfter: { ...r.base },
      };
    });
    assert.deepEqual(large.base, { width: 640, height: 360 });
    assert.deepEqual(large.baseAfter, large.base);
    assert.equal(large.a, 99);
    assert.equal(large.b, 49);
    assert.deepEqual(large.gpu, [99, 32, 32, 255]);
    assert(large.retained <= 8);
    assert(large.quadrants);
    assert.equal(large.glError, 0);
    await page.evaluate(async (path) => {
      await window.__TAURI_INTERNALS__.invoke('export_html', { path });
    }, resolve('local-fixtures/collection-100.html'));
    await page.screenshot({ path: 'local-fixtures/collection-workspace.png' });
    const folders = await Promise.all(
      paths.map(async (path, i) => {
        const folder = resolve(root, `Group ${i + 1}`);
        await mkdir(folder, { recursive: true });
        await copyFile(path, resolve(folder, 'frame00001.png'));
        if (i !== 99) await copyFile(path, resolve(folder, 'frame00002.png'));
        return folder;
      }),
    );
    const folderResult = await page.evaluate(async (folders) => {
      const w = window.__AYORI_WORKSPACE__;
      await w.importPaths(folders);
      w.select(99);
      w.select(49, true);
      while (w.pendingSlots.length) await new Promise((resolve) => setTimeout(resolve, 25));
      const sample = w.frames[99]?.pixels[0];
      // Explicitly selecting a missing source must remain an empty cell.
      await w.loadScene(1);
      w.select(99);
      while (w.pendingSlots.length) await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        sources: w.matrix.sources.length,
        scenes: w.matrix.scenes.length,
        sample,
        missing: w.frames[99] === null,
        resident: w.frames.filter(Boolean).length,
      };
    }, folders);
    assert.deepEqual(folderResult, {
      sources: 100,
      scenes: 2,
      sample: 99,
      missing: true,
      resident: 7,
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        native100: large,
        editableShortcuts: true,
        conflictProtection: true,
        persistence: true,
        tooltip: true,
        frontendErrors: errors,
        folderMatrix: folderResult,
      }),
    );
  } finally {
    await page.evaluate((saved) => {
      ['ayori.shortcuts.v1', 'ayori.interface.v1'].forEach((key, i) =>
        saved[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, saved[i]),
      );
    }, saved);
  }
} finally {
  await browser.close();
}

const offlineBrowser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await offlineBrowser.newPage();
  const errors = [],
    network = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.context().setOffline(true);
  await page.goto(new URL('../local-fixtures/collection-100.html', import.meta.url).href);
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('exact'));
  assert.equal(await page.locator('#sources button').count(), 100);
  await page.getByRole('combobox', { name: 'Source A', exact: true }).selectOption('99');
  await page.waitForFunction(() =>
    document.querySelector('#sources button:last-child').classList.contains('a'),
  );
  await page.locator('[data-mode="2"]').click();
  await page.screenshot({ path: 'local-fixtures/collection-offline.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  console.log(JSON.stringify({ offline100: true, errors, network }));
} finally {
  await offlineBrowser.close();
}
