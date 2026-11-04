import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) =>
    process.argv.includes('--dev')
      ? p.url().startsWith('http://127.0.0.1:1420')
      : p.url() === 'http://tauri.localhost/',
  );
assert(page, 'Launch Ayori with debugging on localhost:9223.');
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const keys = ['ayori.shortcuts.v1', 'ayori.interface.v1'];
const saved = await page.evaluate((keys) => keys.map((k) => localStorage.getItem(k)), keys);
let session;
try {
  await page.evaluate(() => {
    localStorage.removeItem('ayori.shortcuts.v1');
    localStorage.setItem('ayori.interface.v1', JSON.stringify({ autoHide: false, tooltips: true }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  assert.equal(await page.locator('header .brand').innerText(), 'Ayori');
  const initial = await page.locator('header').evaluate((e) => ({
    height: e.getBoundingClientRect().height,
    color: getComputedStyle(e).backgroundColor,
  }));
  assert.deepEqual(initial, { height: 32, color: 'rgb(0, 0, 0)' });
  await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search shortcuts' }).fill('');
  await page.getByRole('textbox', { name: 'Search shortcuts' }).press('q');
  assert(
    await page.getByRole('dialog', { name: 'Help & shortcuts' }).isVisible(),
    'Typing Q never closes the app',
  );
  await page.getByRole('button', { name: 'Interface', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Top bar height', exact: true });
  await slider.focus();
  await page.keyboard.press('Home');
  assert.equal(await slider.inputValue(), '16');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  assert.equal(
    await page.locator('header').evaluate((e) => e.getBoundingClientRect().height),
    16,
    'Height persists',
  );
  const paths = ['WEB-DL', 'Encode'].map((n) => resolve('local-fixtures/user-comparison', n));
  await page.evaluate(
    async (paths) =>
      window.__TAURI_INTERNALS__.invoke('plugin:event|emit_to', {
        target: { kind: 'AnyLabel', label: 'main' },
        event: 'tauri://drag-drop',
        payload: { paths, position: { x: 400, y: 300 } },
      }),
    paths,
  );
  await page.getByRole('button', { name: 'Choose source A' }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.source-chip')].every((b) =>
      b.dataset.tip.includes('1920 × 1080'),
    ),
  );
  session = await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 960,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const layouts = [];
  for (const height of [16, 24, 32, 44]) {
    await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
    await page.getByRole('button', { name: 'Interface', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${height}px`) }).click();
    await page.getByRole('button', { name: 'Close settings' }).click();
    const layout = await page.locator('header').evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        height: r.height,
        color: getComputedStyle(e).backgroundColor,
        overflow: e.scrollWidth > e.clientWidth,
        buttons: [...e.querySelectorAll('button')]
          .map((b) => ({
            name: b.getAttribute('aria-label'),
            r: b.getBoundingClientRect().toJSON(),
          }))
          .filter((b) => b.r.width > 0),
      };
    });
    assert.equal(layout.height, height);
    assert.equal(layout.color, 'rgb(0, 0, 0)');
    assert(!layout.overflow);
    for (const b of layout.buttons)
      assert(
        b.r.x >= 0 && b.r.y >= 0 && b.r.right <= 960 && b.r.bottom <= height,
        JSON.stringify(b),
      );
    for (let i = 1; i < layout.buttons.length; i++)
      assert(layout.buttons[i].r.x >= layout.buttons[i - 1].r.right - 1, 'Overlapping controls');
    await page.getByRole('button', { name: 'View options', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'View options', exact: true });
    await menu.waitFor({ state: 'visible' });
    const bounds = await menu.boundingBox();
    assert(bounds.y >= height && bounds.x >= 0 && bounds.x + bounds.width <= 960);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Close', exact: true }).hover();
    await page.locator('#ayori-tooltip').filter({ hasText: 'Q' }).waitFor({ state: 'visible' });
    await page.mouse.move(800, 500);
    await page.screenshot({ path: `local-fixtures/ayori-bar-${height}.png` });
    layouts.push({ height, controls: layout.buttons.length, overflow: layout.overflow });
  }
  // Persist an arbitrary integer height with keyboard controls, not just presets.
  await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
  await page.getByRole('button', { name: 'Interface', exact: true }).click();
  await slider.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  assert.equal(await slider.inputValue(), '17');
  await page.getByRole('button', { name: /^32px/ }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.locator('canvas').focus();
  await page.keyboard.press('2');
  await page.locator('.same-source').waitFor();
  await page.keyboard.press('1');
  await page.locator('.same-source').waitFor({ state: 'hidden' });
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(
    () =>
      document.querySelector('.scene small')?.textContent.includes('2 / 4') &&
      [...document.querySelectorAll('.source-chip')].every((b) =>
        b.dataset.tip.includes('1920 × 1080'),
      ),
  );
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  await page.getByRole('button', { name: 'View options', exact: true }).click();
  await page.getByRole('button', { name: '200%', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.mouse.move(440, 340);
  await page.mouse.down();
  await page.mouse.move(470, 365);
  await page.mouse.up();
  const clip = { x: 30, y: 80, width: 900, height: 480 };
  const before = await page.screenshot({ clip });
  await page.locator('canvas').focus();
  await page.keyboard.press('Alt+Home');
  await page.getByRole('button', { name: 'Resume comparison' }).waitFor();
  assert.equal(await page.locator('canvas').isVisible(), false);
  await page.keyboard.press('ArrowDown'); // Comparison keys are inactive on Home.
  await page.getByRole('button', { name: 'Resume comparison' }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Split', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  assert.match(await page.locator('.scene small').innerText(), /2 \/ 4/);
  assert.equal(await page.getByRole('button', { name: 'Toggle fit and 100%' }).innerText(), '200%');
  await page.mouse.move(470, 365);
  assert(
    before.equals(await page.screenshot({ clip })),
    'Home preserves the displayed image, pan and zoom',
  );
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Resume comparison' }).waitFor();
  await page.getByRole('button', { name: 'Resume comparison' }).click();
  await session.send('Emulation.clearDeviceMetricsOverride');
  await session.detach();
  session = undefined;
  await page.locator('canvas').focus();
  const maximized = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximized', { label: 'main' }),
  );
  await page.keyboard.press('F10');
  await page.waitForFunction(
    async (initial) =>
      (await window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximized', { label: 'main' })) !==
      initial,
    maximized,
  );
  await page.keyboard.press('F10');
  await page.waitForFunction(
    async (initial) =>
      (await window.__TAURI_INTERNALS__.invoke('plugin:window|is_maximized', { label: 'main' })) ===
      initial,
    maximized,
  );
  // Verify a customized quit key is saved, suppresses old Q, and can be reset.
  await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
  await page.getByRole('button', { name: 'Find Quit Ayori shortcut' }).click();
  await page.getByRole('button', { name: 'Edit Quit Ayori shortcut', exact: true }).click();
  await page.keyboard.press('Control+q');
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem('ayori.shortcuts.v1')).bindings.quit),
    ['Ctrl+q'],
  );
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.locator('canvas').focus();
  await page.keyboard.press('q');
  assert(!page.isClosed());
  await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
  await page.getByRole('button', { name: 'Find Quit Ayori shortcut' }).click();
  await page.getByRole('button', { name: 'Reset Quit Ayori shortcut', exact: true }).click();
  await page.getByRole('button', { name: 'Close settings' }).click();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      layouts,
      homePreservesImage: true,
      homeSuppressesComparisonKeys: true,
      customQuit: true,
      maximizeShortcut: true,
      errors,
    }),
  );
  if (process.argv.includes('--minimize')) {
    await page.locator('canvas').focus();
    await page.keyboard.press('Control+m');
    await page.waitForFunction(async () =>
      window.__TAURI_INTERNALS__.invoke('plugin:window|is_minimized', { label: 'main' }),
    );
    console.log('Minimize shortcut verified. Restore through the OS, then verify Q exits.');
  }
} finally {
  if (session) {
    await session.send('Emulation.clearDeviceMetricsOverride');
    await session.detach();
  }
  if (!page.isClosed())
    await page.evaluate(
      ({ keys, saved }) =>
        keys.forEach((k, i) =>
          saved[i] === null ? localStorage.removeItem(k) : localStorage.setItem(k, saved[i]),
        ),
      { keys, saved },
    );
  await browser.close();
}
