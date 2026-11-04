import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const dev = process.argv.includes('--dev');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) =>
    dev ? p.url().startsWith('http://127.0.0.1:1420') : p.url() === 'http://tauri.localhost/',
  );
assert(page, 'Launch Ayori with local debugging on port 9223.');
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const keys = ['ayori.interface.v1', 'ayori.shortcuts.v1'];
const saved = await page.evaluate((keys) => keys.map((k) => localStorage.getItem(k)), keys);
const cdp = await page.context().newCDPSession(page);
const zoom = () =>
  page.getByRole('button', { name: 'Toggle fit and 100%', exact: true }).innerText();
const double = (x = 650, y = 320) => page.mouse.dblclick(x, y, { button: 'right', delay: 45 });
const settings = async () => {
  await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
  await page.getByRole('button', { name: 'Interface', exact: true }).click();
};
const closeSettings = () => page.getByRole('button', { name: 'Close settings' }).click();
const settle = () =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const crop = () => page.screenshot({ clip: { x: 70, y: 90, width: 780, height: 430 } });
const reset = async () => {
  await page.locator('canvas').focus();
  await page.keyboard.press('Control+0');
  await settle();
};
const importFrames = async () => {
  await page.evaluate(
    async (paths) =>
      window.__TAURI_INTERNALS__.invoke('plugin:event|emit_to', {
        target: { kind: 'AnyLabel', label: 'main' },
        event: 'tauri://drag-drop',
        payload: { paths, position: { x: 400, y: 300 } },
      }),
    ['WEB-DL', 'Encode'].map((n) => resolve('local-fixtures/user-comparison', n)),
  );
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.source-chip')].length === 2 &&
      [...document.querySelectorAll('.source-chip')].every((e) =>
        e.dataset.tip.includes('1920 × 1080'),
      ),
  );
};
try {
  await page.evaluate(() => {
    localStorage.removeItem('ayori.shortcuts.v1');
    localStorage.setItem('ayori.interface.v1', JSON.stringify({ autoHide: false }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  await settings();
  const target = page.getByRole('spinbutton', { name: 'Double-right-click target zoom' });
  assert.equal(await target.inputValue(), '200');
  assert(await page.getByRole('checkbox', { name: 'Enable double-right-click zoom' }).isChecked());
  await target.fill('375');
  await target.press('Tab');
  await closeSettings();
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  await settings();
  assert.equal(await target.inputValue(), '375', 'Custom target survives reload');
  await closeSettings();
  await importFrames();
  const scales = [];
  for (const scale of [1, 1.25, 1.5, 2]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 960,
      height: 600,
      deviceScaleFactor: scale,
      mobile: false,
    });
    await page.locator('canvas').focus();
    await page.keyboard.press('d');
    await reset();
    await page.mouse.move(650, 320);
    const before = await zoom();
    const image = await crop();
    const uv = dev
      ? await page.evaluate(() => {
          const r = window.__AYORI_WORKSPACE__.renderer,
            p = r.point({ clientX: 650, clientY: 320 });
          return [
            (p.x - r.canvas.width / 2 - r.view.pan.x) / r.view.zoom / r.base.width,
            (p.y - r.view.pan.y) / r.view.zoom / r.base.height,
          ];
        })
      : null;
    await double();
    assert.equal(await zoom(), '375%');
    if (dev) {
      const next = await page.evaluate(() => {
        const r = window.__AYORI_WORKSPACE__.renderer,
          p = r.point({ clientX: 650, clientY: 320 });
        return [
          (p.x - r.canvas.width / 2 - r.view.pan.x) / r.view.zoom / r.base.width,
          (p.y - r.view.pan.y) / r.view.zoom / r.base.height,
        ];
      });
      next.forEach((n, i) =>
        assert(Math.abs(n - uv[i]) < 1e-12, 'Click stays on same source coordinate'),
      );
    }
    await page.mouse.move(630, 320);
    await page.mouse.down();
    await page.mouse.move(680, 350, { steps: 3 });
    await page.mouse.up();
    await double();
    assert.equal(await zoom(), before);
    await settle();
    assert.deepEqual(await crop(), image, 'Return restores the exact displayed crop after panning');
    scales.push(scale);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 960,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await reset();
  const fit = await zoom();
  await page.mouse.click(650, 320, { button: 'right' });
  assert.equal(await zoom(), fit, 'Single click does not zoom');
  await page.waitForTimeout(550);
  await page.mouse.click(650, 320, { button: 'right' });
  assert.equal(await zoom(), fit, 'Slow clicks do not zoom');
  await page.mouse.click(680, 320, { button: 'right' });
  assert.equal(await zoom(), fit, 'Distant clicks do not zoom');
  await reset();
  await page.mouse.move(650, 320);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(260);
  if (dev) assert(await page.evaluate(() => window.__AYORI_WORKSPACE__.renderer.view.loupe));
  await page.keyboard.down('Shift');
  await page.keyboard.press('2');
  await page.keyboard.up('Shift');
  if (dev)
    assert(
      await page.evaluate(() => window.__AYORI_WORKSPACE__.renderer.view.loupe),
      'Right-held loupe survives keyboard release',
    );
  await page.mouse.up({ button: 'right' });
  if (dev) assert(!(await page.evaluate(() => window.__AYORI_WORKSPACE__.renderer.view.loupe)));
  assert.equal(await zoom(), fit);
  await double();
  await page.keyboard.press('1');
  await double();
  assert.equal(await zoom(), fit, 'Source switch retains the return view');
  await double();
  await page.keyboard.press('Control+0');
  await double();
  assert.equal(await zoom(), '375%', 'Fit discards the previous return view');
  await reset();
  await double();
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1000,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await settle();
  if (dev)
    assert.equal(
      await page.evaluate(() => window.__AYORI_WORKSPACE__.renderer.quickZoomReturn),
      null,
      'Resize invalidates the return snapshot',
    );
  await double();
  assert.equal(await zoom(), '375%', 'Resizing does not restore an obsolete viewport');
  await reset();
  await page.mouse.click(650, 320, { button: 'right' });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.click(650, 320, { button: 'right' });
  assert.notEqual(await zoom(), '375%', 'Blur invalidates pending clicks');
  await settings();
  await page.getByRole('checkbox', { name: 'Enable double-right-click zoom' }).uncheck();
  await closeSettings();
  const disabledZoom = await zoom();
  await page.mouse.move(650, 320);
  await page.mouse.down({ button: 'right' });
  if (dev)
    assert(
      await page.evaluate(() => window.__AYORI_WORKSPACE__.renderer.view.loupe),
      'Disabled gesture restores immediate loupe',
    );
  await page.mouse.up({ button: 'right' });
  await double();
  assert.equal(await zoom(), disabledZoom);
  await settings();
  await page.getByRole('checkbox', { name: 'Enable double-right-click zoom' }).check();
  await page.getByRole('button', { name: '200%', exact: true }).click();
  await page.screenshot({ path: 'local-fixtures/quick-zoom-settings.png' });
  await closeSettings();
  await double();
  assert.equal(await zoom(), '200%');
  await page.keyboard.press('Alt+Home');
  await page.getByRole('button', { name: 'Resume comparison' }).click();
  assert.equal(await zoom(), '200%');
  await double();
  assert.equal(await zoom(), disabledZoom, 'Home/resume retains the return view');
  await page.evaluate(
    async (path) => window.__TAURI_INTERNALS__.invoke('export_html', { path }),
    resolve('local-fixtures/quick-zoom.html'),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      customTarget: 375,
      restoredCropsAtDpi: scales,
      loupe: true,
      invalidation: true,
      disabled: true,
      home: true,
      errors,
    }),
  );
} finally {
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await cdp.detach();
  await page.evaluate(
    ({ keys, saved }) =>
      keys.forEach((k, i) =>
        saved[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[i]),
      ),
    { keys, saved },
  );
  await browser.close();
}
