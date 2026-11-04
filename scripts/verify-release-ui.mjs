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
    .find((p) =>
      process.argv.includes('--dev')
        ? p.url().startsWith('http://127.0.0.1:1420')
        : p.url() === 'http://tauri.localhost/',
    );
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
    for (const [side, dimensions] of [
      ['A', '640 × 360'],
      ['B', '512 × 288'],
    ]) {
      await page.waitForFunction(
        ({ side, dimensions }) =>
          document
            .querySelector(`[aria-label="Choose source ${side}"]`)
            ?.dataset.tip.includes(dimensions),
        { side, dimensions },
      );
      await page.getByRole('button', { name: `Choose source ${side}`, exact: true }).hover();
      await page
        .locator('#ayori-tooltip')
        .filter({ hasText: dimensions })
        .waitFor({ state: 'visible' });
    }
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
    const toolbar = await page.locator('header').evaluate((header) => {
      const bounds = header.getBoundingClientRect();
      const buttons = [...header.querySelectorAll('button')]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => {
          const r = b.getBoundingClientRect();
          return {
            label: b.getAttribute('aria-label'),
            x: r.x,
            y: r.y,
            right: r.right,
            bottom: r.bottom,
          };
        });
      return { height: bounds.height, overflow: header.scrollWidth > header.clientWidth, buttons };
    });
    assert.equal(toolbar.height, 44);
    assert.equal(toolbar.overflow, false);
    for (const b of toolbar.buttons)
      assert(b.x >= 0 && b.right <= 960 && b.y >= 0 && b.bottom <= 44, JSON.stringify(b));
    for (let i = 1; i < toolbar.buttons.length; i++)
      assert(toolbar.buttons[i].x >= toolbar.buttons[i - 1].right - 1, 'Toolbar controls overlap');
    await page.screenshot({ path: 'local-fixtures/compact-workspace-960.png' });
    // Native popovers light-dismiss, restore focus on Escape, and can reopen.
    const options = page.getByRole('button', { name: 'View options', exact: true });
    const menu = page.getByRole('dialog', { name: 'View options', exact: true });
    await options.click();
    await menu.waitFor({ state: 'visible' });
    await options.click();
    await menu.waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="View options"]')?.getAttribute('aria-expanded') ===
        'false',
    );
    assert.equal(
      await options.getAttribute('aria-expanded'),
      'false',
      'Trigger closes its open menu',
    );
    await options.click();
    await menu.waitFor({ state: 'visible' });
    const menuBounds = await menu.boundingBox();
    assert(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 960);
    await menu.getByRole('button', { name: '400%', exact: true }).click();
    await page
      .getByRole('button', { name: 'Toggle fit and 100%' })
      .filter({ hasText: '400%' })
      .waitFor();
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="View options"]')?.getAttribute('aria-expanded') ===
        'false',
    );
    assert.equal(await options.getAttribute('aria-expanded'), 'false');
    assert(
      await options.evaluate((b) => b === document.activeElement),
      'Escape returns focus to View options',
    );
    await options.click();
    await menu.waitFor({ state: 'visible' });
    await page.mouse.click(480, 500);
    await menu.waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="View options"]')?.getAttribute('aria-expanded') ===
        'false',
    );
    await options.click();
    await menu.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Import images or folders' }).click();
    await page.getByRole('dialog', { name: 'Import comparison' }).waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('canvas').focus();
    await page.keyboard.press('v');
    await page.getByRole('textbox', { name: 'Search scenes' }).fill('no such frame');
    await page.getByText('No matching scenes.', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Scenes', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Settings and shortcuts', exact: true }).click();
    assert.equal(
      await page.locator('.shortcut-row').count(),
      12,
      'Only essentials are shown initially',
    );
    assert.equal(
      await page.locator('.shortcut-row').first().locator('strong').textContent(),
      'Flicker previous source',
    );
    await page.getByRole('button', { name: 'Show more shortcuts', exact: true }).click();
    assert.equal(await page.locator('.shortcut-row').count(), 53);
    await page.getByRole('button', { name: 'Essentials only', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search shortcuts' }).fill('export');
    await page.getByRole('button', { name: 'Edit Export HTML shortcut', exact: true }).waitFor();
    await page.getByRole('textbox', { name: 'Search shortcuts' }).fill('');
    const layout = await page
      .getByRole('dialog', { name: 'Help & shortcuts' })
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
    await page.getByRole('button', { name: 'Using & comparing', exact: true }).click();
    await page.getByRole('heading', { name: '1 · Bring in your sources' }).waitFor();
    await page.getByRole('button', { name: 'Comparing images', exact: true }).click();
    await page.getByRole('heading', { name: 'Use differences and scores as clues' }).waitFor();
    await page.screenshot({ path: 'local-fixtures/compact-comparison-guide.png' });
    await page.getByRole('button', { name: 'Close settings' }).click();
    await session.send('Emulation.clearDeviceMetricsOverride');
    await session.detach();
    if (!process.argv.includes('--dev'))
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
        compactToolbar: toolbar,
        popoverDismissal: true,
        essentialsAndGuides: true,
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
