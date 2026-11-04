import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [],
    network = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  // Observe draw uniforms without adding app diagnostics to the export.
  await page.addInitScript(() => {
    const names = new WeakMap(),
      proto = WebGL2RenderingContext.prototype;
    const location = proto.getUniformLocation;
    window.__draw = {};
    proto.getUniformLocation = function (...args) {
      const result = location.apply(this, args);
      if (result) names.set(result, args[1]);
      return result;
    };
    for (const method of ['uniform1f', 'uniform2f', 'uniform1i']) {
      const original = proto[method];
      proto[method] = function (location, ...values) {
        window.__draw[names.get(location)] = values.length === 1 ? values[0] : values;
        return original.call(this, location, ...values);
      };
    }
  });
  await page.context().setOffline(true);
  await page.goto(new URL('../local-fixtures/quick-zoom.html', import.meta.url).href);
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('2 ready'),
  );
  assert.equal(await page.locator('#scenes option').count(), 4);
  const target = page.getByRole('spinbutton', { name: 'Double-right-click target zoom' });
  assert.equal(await target.inputValue(), '200');
  await target.fill('375');
  await target.press('Tab');
  await page.locator('[data-mode="2"]').click();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.mouse.move(950, 420);
  const settle = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const view = () =>
    page.evaluate(() => ({ zoom: window.__draw.u_zoom, pan: window.__draw.u_pan }));
  const double = () => page.mouse.dblclick(950, 420, { button: 'right', delay: 45 });
  await settle();
  const before = await view();
  const clip = { x: 230, y: 180, width: 1050, height: 480 };
  const image = await page.screenshot({ clip });
  await double();
  await settle();
  assert.equal((await view()).zoom, 3.75);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'CANVAS');
  await page.mouse.down();
  await page.mouse.move(1000, 450, { steps: 3 });
  await page.mouse.up();
  await double();
  await settle();
  assert.deepEqual(await view(), before);
  assert.deepEqual(await page.screenshot({ clip }), image);
  await page.keyboard.press('g');
  await page.mouse.move(950, 420);
  await settle();
  const pixels = await page.locator('#pixels').innerText();
  await double();
  await settle();
  assert.equal(
    await page.locator('#pixels').innerText(),
    pixels,
    'Clicked source sample remains anchored',
  );
  await double();
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(260);
  assert.equal(await page.evaluate(() => window.__draw.u_loupe), 1);
  await page.keyboard.down('Shift');
  await page.keyboard.up('Shift');
  await settle();
  assert.equal(await page.evaluate(() => window.__draw.u_loupe), 1);
  await page.mouse.up({ button: 'right' });
  await settle();
  assert.equal(await page.evaluate(() => window.__draw.u_loupe), 0);
  await double();
  await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('#scenes').value === '1' &&
      document.querySelector('#status').textContent.includes('2 ready'),
  );
  await double();
  await settle();
  assert.equal((await view()).zoom, 3.75, 'New scene starts a new toggle');
  await page.screenshot({ path: 'local-fixtures/quick-zoom-offline.png' });
  assert.deepEqual(errors, []);
  assert.deepEqual(network, []);
  console.log(
    JSON.stringify({
      offlineZoom: true,
      restoredViewAndPixels: true,
      loupe: true,
      sceneReset: true,
      errors,
      network,
    }),
  );
} finally {
  await browser.close();
}
