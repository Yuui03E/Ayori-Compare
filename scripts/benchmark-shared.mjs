import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

let browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
let page = browser.contexts()[0].pages()[0];
await page.evaluate(() => {
  delete window.__SHARED_RESULT__;
  setTimeout(async () => {
    const bridge = window.chrome.webview;
    let resolveFrame;
    const receive = (event) => resolveFrame(event.getBuffer());
    bridge.addEventListener('sharedbufferreceived', receive);
    try {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      if (!(await invoke('shared_frames_available'))) throw Error('Shared frames unavailable');
      const size = await invoke('benchmark_prepare');
      const samples = [];
      for (let i = 0; i < 55; i++) {
        const received = new Promise((resolve) => {
          resolveFrame = resolve;
        });
        const start = performance.now();
        const command = invoke('benchmark_shared_transfer', { request: `benchmark-${i}` });
        const data = await received;
        const ms = performance.now() - start;
        try {
          if (!(data instanceof ArrayBuffer) || data.byteLength !== size)
            throw Error('Invalid response');
          const bytes = new Uint8Array(data);
          const expected = [31, 63, 127, 255];
          for (let j = 32; j < size; j++) {
            if (bytes[j] !== expected[j % 4]) throw Error(`Wrong sample at ${j}`);
          }
        } finally {
          bridge.releaseBuffer(data);
          await invoke('release_shared_frame', { request: `benchmark-${i}` });
        }
        await command;
        if (i >= 5) samples.push(ms);
      }
      samples.sort((a, b) => a - b);
      window.__SHARED_RESULT__ = {
        size,
        samples: 50,
        medianMs: samples[25],
        p95Ms: samples[47],
        maxMs: samples[49],
        debuggerAttached: false,
        allPayloadBytesVerified: true,
      };
    } catch (e) {
      window.__SHARED_RESULT__ = { error: String(e) };
    } finally {
      bridge.removeEventListener('sharedbufferreceived', receive);
    }
  }, 1500);
});
await browser.close();
await new Promise((resolve) => setTimeout(resolve, 12000));
browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  page = browser.contexts()[0].pages()[0];
  const result = await page.evaluate(() => window.__SHARED_RESULT__);
  if (!result || result.error) throw Error(JSON.stringify(result));
  await writeFile('local-fixtures/shared-transfer.json', JSON.stringify(result, null, 2));
  console.log(result);
} finally {
  await browser.close();
}
