import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Uses only visible product controls and the normal native drag/drop event.
// Generate the original 100-image corpus with verify-collections.mjs first.
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url() === 'http://tauri.localhost/');
  assert(page, 'Start the normal packaged application with debugging on localhost:9223.');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  const saved = await page.evaluate(() => localStorage.getItem('ayori.shortcuts.v1'));
  try {
    await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search shortcuts' }).fill('pixel grid');
    await page
      .getByRole('button', { name: 'Edit Pixel grid & readout shortcut', exact: true })
      .click();
    await page.keyboard.press('Control+Alt+g');
    await page.getByText('Shortcut saved.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
    const paths = Array.from({ length: 100 }, (_, i) =>
      resolve(`local-fixtures/collection-100/Release ${i + 1}.png`),
    );
    await page.evaluate(async (paths) => {
      await window.__TAURI_INTERNALS__.invoke('plugin:event|emit_to', {
        target: { kind: 'AnyLabel', label: 'main' },
        event: 'tauri://drag-drop',
        payload: { paths, position: { x: 400, y: 300 } },
      });
    }, paths);
    await page.getByRole('button', { name: 'Browse sources', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Browse sources', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sources' }).fill('Release 100.');
    await page.getByRole('button', { name: 'Set source 100 as A', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search sources' }).fill('Release 50.');
    await page.getByRole('button', { name: 'Set source 50 as B', exact: true }).click();
    await page.getByRole('button', { name: 'View comparison', exact: true }).click();
    await page
      .locator('.selection')
      .first()
      .locator('.metadata')
      .filter({ hasText: '640 × 360' })
      .waitFor();
    await page
      .locator('.selection')
      .nth(1)
      .locator('.metadata')
      .filter({ hasText: '512 × 288' })
      .waitFor();
    await page.locator('canvas').focus();
    await page.keyboard.press('Control+Alt+g');
    assert.equal(
      await page
        .getByRole('button', { name: 'Pixel grid and readout' })
        .getAttribute('aria-pressed'),
      'true',
    );
    await page.keyboard.press('Control+Alt+g');
    await page.getByRole('button', { name: 'Pixel grid and readout' }).hover();
    await page
      .locator('#ayori-tooltip')
      .filter({ hasText: 'Ctrl + Alt + G' })
      .waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await page.mouse.move(1200, 400);
    await page.screenshot({ path: 'local-fixtures/release-collection-verified.png' });
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 960,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
    const layout = await page
      .getByRole('dialog', { name: 'Settings & shortcuts' })
      .evaluate((dialog) => {
        const bounds = dialog.getBoundingClientRect();
        return {
          x: bounds.x,
          y: bounds.y,
          right: bounds.right,
          bottom: bounds.bottom,
          overflow: dialog.scrollWidth > dialog.clientWidth + 1,
        };
      });
    assert(
      layout.x >= 0 &&
        layout.y >= 0 &&
        layout.right <= 960 &&
        layout.bottom <= 600 &&
        !layout.overflow,
    );
    await page.screenshot({ path: 'local-fixtures/release-settings-960.png' });
    await page.getByRole('button', { name: 'Close settings' }).click();
    await session.send('Emulation.clearDeviceMetricsOverride');
    await session.detach();
    assert.equal(await page.evaluate(() => typeof window.__AYORI_WORKSPACE__), 'undefined');
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        packaged100Sources: true,
        arbitraryPair: [100, 50],
        savedShortcut: true,
        tooltip: true,
        split: true,
        minimumWindowLayout: layout,
        frontendErrors: errors,
      }),
    );
  } finally {
    await page.evaluate(
      (saved) =>
        saved === null
          ? localStorage.removeItem('ayori.shortcuts.v1')
          : localStorage.setItem('ayori.shortcuts.v1', saved),
      saved,
    );
  }
} finally {
  await browser.close();
}
