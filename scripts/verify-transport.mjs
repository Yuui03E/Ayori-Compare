import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser.contexts()[0].pages()[0];
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  const paths = [
    'local-fixtures/Reference/00001.png',
    'local-fixtures/High-depth/00001.png',
    'src-tauri/tests/fixtures/ramp10.avif',
    'src-tauri/tests/fixtures/ramp12.avif',
  ].map((p) => resolve(p));
  const result = await page.evaluate(async (paths) => {
    const w = window.__AYORI_WORKSPACE__,
      bridge = window.chrome.webview;
    let received = 0,
      released = 0;
    const buffers = new Set();
    bridge.addEventListener('sharedbufferreceived', (event) => {
      received++;
      buffers.add(event.getBuffer());
    });
    const originalRelease = bridge.releaseBuffer.bind(bridge);
    bridge.releaseBuffer = (buffer) => {
      if (!buffers.delete(buffer)) throw Error('Unknown or already released buffer');
      released++;
      originalRelease(buffer);
      if (buffer.byteLength !== 0) throw Error('Released buffer must detach');
    };
    await w.importPaths(paths);
    if (Object.keys(w.errors).length) throw Error(JSON.stringify(w.errors));
    if (received !== 4 || buffers.size !== 4) throw Error('Frame path did not use shared buffers');
    for (let i = 0; i < 4; i++) {
      const reference = new Uint8Array(
        await window.__TAURI_INTERNALS__.invoke('load_frame_binary', {
          path: w.matrix.scenes[0].frames[i],
          epoch: w.epoch,
        }),
      );
      const shared = new Uint8Array(w.frames[i].pixels.buffer);
      if (reference.length !== shared.length) throw Error('Length mismatch');
      for (let j = 0; j < reference.length; j++)
        if (reference[j] !== shared[j]) throw Error(`Byte mismatch ${i}:${j}`);
    }
    // Re-uploading retained frames (as on graphics-context recovery) must not
    // detach their source buffer. Replacing and clearing must release them.
    for (let i = 0; i < 4; i++) w.renderer.upload(i, w.frames[i]);
    if (released !== 0) throw Error('Re-upload released retained source values');
    const retained = w.frames.map((f) => f?.pixels.buffer).filter(Boolean);
    await w.loadScene(0);
    if (retained.some((b) => b.byteLength !== 0)) throw Error('Old source mapping still retained');
    await Promise.all(Array.from({ length: 12 }, () => w.loadScene(0)));
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (buffers.size !== 4 || Object.keys(w.errors).length)
      throw Error('Stale scene ownership failed');
    w.dispose();
    if (buffers.size !== 0 || received !== released) throw Error('Disposal leaked source mappings');
    return {
      exactPackets: 4,
      sourceDepths: [8, 16, 10, 12],
      received,
      released,
      staleLoads: true,
      detachedOnRelease: true,
    };
  }, paths);
  assert.equal(result.received, result.released);
  await page.waitForFunction(async () => {
    const state = await window.__TAURI_INTERNALS__.invoke('benchmark_shared_state');
    return state.active === 0 && state.pending === 0 && state.spareBytes <= 32 * 1024 * 1024;
  });
  result.nativeAfterDispose = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke('benchmark_shared_state'),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Open images', exact: true }).waitFor();
  result.nativeAfterNavigation = await page.evaluate(() =>
    window.__TAURI_INTERNALS__.invoke('benchmark_shared_state'),
  );
  assert.deepEqual(result.nativeAfterNavigation, { active: 0, pending: 0, spareBytes: 0 });
  console.log(result);
} finally {
  await browser.close();
}
