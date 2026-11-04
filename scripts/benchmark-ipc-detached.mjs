import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
let browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
let page = browser.contexts()[0].pages()[0];
await page.evaluate(() => {
  delete window.__IPC_RESULT__;
  setTimeout(async () => {
    try {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const size = await invoke('benchmark_prepare');
      const samples = [];
      for (let i = 0; i < 55; i++) {
        const start = performance.now();
        const data = await invoke('benchmark_transfer');
        const ms = performance.now() - start;
        if (!(data instanceof ArrayBuffer) || data.byteLength !== size)
          throw Error('Invalid response');
        if (i >= 5) samples.push(ms);
      }
      samples.sort((a, b) => a - b);
      window.__IPC_RESULT__ = {
        size,
        samples: 50,
        medianMs: samples[25],
        p95Ms: samples[47],
        maxMs: samples[49],
        debuggerAttached: false,
      };
    } catch (e) {
      window.__IPC_RESULT__ = { error: String(e) };
    }
  }, 1500);
});
await browser.close();
await new Promise((resolve) => setTimeout(resolve, 9000));
browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  page = browser.contexts()[0].pages()[0];
  const result = await page.evaluate(() => window.__IPC_RESULT__);
  if (!result || result.error) throw Error(JSON.stringify(result));
  await writeFile('local-fixtures/ipc-detached.json', JSON.stringify(result, null, 2));
  console.log(result);
} finally {
  await browser.close();
}
