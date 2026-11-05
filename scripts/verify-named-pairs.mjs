import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only verification of the reported src_01 / final_01 WebP collection.
// Start the normal packaged app with WebView2 debugging and a separate profile.
assert(process.argv[2], 'Pass the comparison folder containing src_01 / final_01 pairs.');
const folder = resolve(process.argv[2]);
const port = process.env.AYORI_DEBUG_PORT || '9223';
const output = resolve('local-fixtures/named-pairs');
await mkdir(output, { recursive: true });
const files = (await readdir(folder)).filter((f) => /^(src|final)_\d+\.webp$/i.test(f));
const numbers = files
  .filter((f) => /^src_/i.test(f))
  .map((f) => Number(f.match(/\d+/)[0]))
  .sort((a, b) => a - b);
assert(numbers.length > 0);
assert.equal(files.length, numbers.length * 2);
const native = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
let offline;
try {
  const page = native
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url() === 'http://tauri.localhost/');
  assert(page, 'Start the normal packaged application.');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await page.getByRole('button', { name: 'Open folders', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.__AYORI_WORKSPACE__), 'undefined');
  const invoke = (command, args) =>
    page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), {
      command,
      args,
    });
  for (const paths of [[folder], files.map((f) => resolve(folder, f))]) {
    const matrix = await invoke('import_sources', { paths, append: false });
    assert.deepEqual(
      matrix.sources.map((s) => s.label),
      ['src', 'final'],
    );
    assert.equal(matrix.scenes.length, numbers.length);
    assert.deepEqual(matrix.warnings, []);
    for (let i = 0; i < numbers.length; i++) {
      assert.equal(matrix.scenes[i].label, `Frame ${String(numbers[i]).padStart(5, '0')}`);
      assert(
        matrix.scenes[i].frames[0].endsWith(`src_${String(numbers[i]).padStart(2, '0')}.webp`),
      );
      assert(
        matrix.scenes[i].frames[1].endsWith(`final_${String(numbers[i]).padStart(2, '0')}.webp`),
      );
    }
  }
  const htmlPath = resolve(output, 'comparison.html');
  await invoke('export_html', { path: htmlPath });
  const html = await readFile(htmlPath, 'utf8');
  assert(!html.includes(folder), 'Export must omit absolute input paths.');
  await invoke('plugin:event|emit_to', {
    target: { kind: 'AnyLabel', label: 'main' },
    event: 'tauri://drag-drop',
    payload: { paths: [folder], position: { x: 400, y: 300 } },
  });
  const waitPair = async (number) => {
    await page.waitForFunction(
      (number) => {
        const a = document.querySelector('[aria-label="Choose source A"]');
        const b = document.querySelector('[aria-label="Choose source B"]');
        const id = String(number).padStart(2, '0');
        return (
          a?.textContent.includes(`src_${id}.webp`) &&
          b?.textContent.includes(`final_${id}.webp`) &&
          !a.dataset.tip.includes('Loading source') &&
          /SSIM2 [\d.-]+/.test(b.dataset.tip)
        );
      },
      number,
      { timeout: 60000 },
    );
  };
  const scenes = [];
  for (let i = 0; i < numbers.length; i++) {
    await waitPair(numbers[i]);
    assert.equal((await page.locator('.browse .count').textContent()).trim(), '2');
    assert.equal(
      (await page.locator('.scene small').textContent()).trim(),
      `${i + 1} / ${numbers.length}`,
    );
    scenes.push({
      a: await page.locator('[aria-label="Choose source A"] .source-name').textContent(),
      b: await page.locator('[aria-label="Choose source B"] .source-name').textContent(),
      metadata: await page.locator('[aria-label="Choose source B"]').getAttribute('data-tip'),
    });
    if (i < numbers.length - 1)
      await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Exchange A and B', exact: true }).click();
  assert((await page.locator('[aria-label="Choose source A"]').textContent()).includes('final_'));
  await page.getByRole('button', { name: 'Exchange A and B', exact: true }).click();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  await page.screenshot({ path: resolve(output, 'packaged-comparison.png') });
  assert.deepEqual(errors, []);

  offline = await chromium.launch({ headless: true });
  const context = await offline.newContext({ offline: true });
  const viewer = await context.newPage();
  const offlineErrors = [],
    requests = [];
  viewer.on('pageerror', (e) => offlineErrors.push(e.message));
  viewer.on('request', (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await viewer.goto(pathToFileURL(htmlPath).href);
  await viewer.waitForFunction(() =>
    /exact decoded samples|exact source readout retained/.test(
      document.querySelector('#status').textContent,
    ),
  );
  const manifest = await viewer.locator('#manifest').textContent();
  const parsed = JSON.parse(manifest);
  assert.deepEqual(
    parsed.sources.map((s) => s.label),
    ['src', 'final'],
  );
  assert.equal(parsed.scenes.length, numbers.length);
  assert.equal(await viewer.locator('#scenes option').count(), numbers.length);
  for (let i = 0; i < numbers.length; i++) {
    await viewer.locator('#scenes').selectOption(String(i));
    await viewer.waitForFunction(() =>
      /exact decoded samples|exact source readout retained/.test(
        document.querySelector('#status').textContent,
      ),
    );
  }
  await viewer.locator('[data-mode="2"]').click();
  await viewer.screenshot({ path: resolve(output, 'offline-comparison.png') });
  assert.deepEqual(requests, []);
  assert.deepEqual(offlineErrors, []);
  const report = {
    packaged: true,
    folderAndFiles: true,
    sources: 2,
    scenes,
    activeFilenames: true,
    exchange: true,
    offlineScenes: parsed.scenes.length,
    offlineHttpRequests: requests.length,
    frontendErrors: errors,
    offlineErrors,
  };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await offline?.close();
  await native.close();
}
