import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

// Launch the unmodified packaged executable with the local WebView2 debugging
// port enabled. This checks the bundled frontend and real native commands.
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url() === 'http://tauri.localhost/');
  assert(page, 'Start the packaged Windows app with WebView2 debugging on port 9223.');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => typeof window.__AYORI_WORKSPACE__),
    'undefined',
    'Production must not expose the development workspace',
  );
  await assert.rejects(
    page.evaluate(() => window.__TAURI_INTERNALS__.invoke('benchmark_prepare')),
    /not found|unknown command/i,
    'Measurement commands must be absent from the normal release',
  );
  await assert.rejects(
    page.evaluate(() => window.__TAURI_INTERNALS__.invoke('benchmark_shared_state')),
    /not found|unknown command/i,
  );
  await page.evaluate(() => {
    const bridge = window.chrome.webview;
    window.__SHARED_COUNTS__ = { received: 0, released: 0 };
    bridge.addEventListener('sharedbufferreceived', () => window.__SHARED_COUNTS__.received++);
    const release = bridge.releaseBuffer.bind(bridge);
    bridge.releaseBuffer = (buffer) => {
      release(buffer);
      window.__SHARED_COUNTS__.released++;
      if (buffer.byteLength !== 0) throw Error('Source mapping was not detached');
    };
  });
  const roots = process.argv.slice(2);
  const paths = roots.length
    ? roots.map((p) => resolve(p))
    : ['Reference', 'Grain', 'Quantized', 'High-depth'].map((p) => resolve('local-fixtures', p));
  await page.evaluate(async (paths) => {
    await window.__TAURI_INTERNALS__.invoke('plugin:event|emit_to', {
      target: { kind: 'AnyLabel', label: 'main' },
      event: 'tauri://drag-drop',
      payload: { paths, position: { x: 400, y: 300 } },
    });
  }, paths);
  await page.getByRole('button', { name: 'Copy PNG', exact: true }).waitFor();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('.source-chip')].some((b) =>
        b.dataset.tip.includes('Loading source'),
      ),
  );
  assert.equal(Number(await page.locator('.browse .count').textContent()), paths.length);
  const sceneCount = Number(
    (await page.locator('.scene small').textContent()).split('/')[1].trim(),
  );
  await page.waitForFunction(() => window.__SHARED_COUNTS__.received > 0);
  // The production frontend must release sources across real scene navigation.
  if (sceneCount > 1) {
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => window.__SHARED_COUNTS__.released > 0);
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('.source-chip')].some((b) =>
          b.dataset.tip.includes('Loading source'),
        ),
    );
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('.source-chip')].some((b) =>
          b.dataset.tip.includes('Loading source'),
        ),
    );
  }
  await page.keyboard.press('h');
  await page.keyboard.press('h');
  await page.keyboard.press('2');
  await page.keyboard.press('Space');
  await page.keyboard.press('f');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const original = canvas.toBlob.bind(canvas);
    canvas.toBlob = (callback, ...args) =>
      original(
        async (blob) => {
          if (blob) {
            window.__COPIED_PNG__ = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          }
          callback(blob);
        },
        ...args,
      );
  });
  await page.keyboard.press('Control+c');
  await page.getByText('Comparison image copied.', { exact: true }).waitFor({ timeout: 15000 });
  const captured = await page.evaluate(() => window.__COPIED_PNG__);
  assert(captured?.startsWith('data:image/png;base64,'));
  await writeFile(
    resolve('local-fixtures/copied-reference.png'),
    Buffer.from(captured.split(',')[1], 'base64'),
  );
  const initial = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximized', { label: 'main' }),
  );
  await page.getByRole('button', { name: 'Maximize or restore', exact: true }).click();
  await page.waitForFunction(
    async (initial) =>
      (await window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximized', { label: 'main' })) !==
      initial,
    initial,
  );
  await page.getByRole('button', { name: 'Maximize or restore', exact: true }).click();
  await page.waitForFunction(
    async (initial) =>
      (await window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximized', { label: 'main' })) ===
      initial,
    initial,
  );
  await page.keyboard.press('m');
  await page.keyboard.press('2');
  await page.screenshot({ path: resolve('local-fixtures/release-verified.png') });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      packagedLaunch: true,
      bundledFrontend: true,
      importedSources: paths.length,
      sceneCount,
      clipboard: true,
      maximizeRestore: true,
      sharedBuffers: await page.evaluate(() => window.__SHARED_COUNTS__),
      frontendErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
