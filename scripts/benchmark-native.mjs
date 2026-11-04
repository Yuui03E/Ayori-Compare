import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find(
      (p) => p.url().startsWith('http://127.0.0.1:1420') || p.url() === 'http://tauri.localhost/',
    );
  assert(page, 'Run a diagnostics-feature native build with WebView2 debugging on port 9223.');
  await page.bringToFront();
  await page.reload();
  await page.getByRole('button', { name: 'Explore a sample comparison' }).waitFor();
  const result = await page.evaluate(async () => {
    const stats = (values) => {
      const v = [...values].sort((a, b) => a - b);
      return {
        samples: v.length,
        medianMs: v[Math.floor(v.length / 2)],
        p95Ms: v[Math.ceil(v.length * 0.95) - 1],
        maxMs: v.at(-1),
      };
    };
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const packetBytes = await invoke('benchmark_prepare');
    const ipc = [];
    for (let i = 0; i < 55; i++) {
      const start = performance.now();
      const buffer = await invoke('benchmark_transfer');
      const elapsed = performance.now() - start;
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== packetBytes)
        throw Error('Incorrect IPC response');
      const data = new Uint8Array(buffer);
      if (data[0] !== 65 || data[32] !== 31 || data.at(-1) !== 255)
        throw Error('IPC bytes changed');
      if (i >= 5) ipc.push(elapsed);
    }
    const ipcResult = {
      packetBytes,
      ...stats(ipc),
      includes:
        'native owned-buffer copy, worker dispatch and Tauri round trip; excludes decode and GPU upload',
    };
    const w = window.__AYORI_WORKSPACE__;
    if (!w)
      return {
        userAgent: navigator.userAgent,
        ipc: ipcResult,
        glError: 0,
        note: 'Packaged frontend; IPC-only measurement',
      };
    await w.showDemo();
    const r = w.renderer;
    w.grid = false;
    const batches = [];
    for (let batch = 0; batch < 55; batch++) {
      await new Promise(requestAnimationFrame);
      const start = performance.now();
      for (let i = 0; i < 1000; i++) w.select(i % 4);
      if (batch >= 5) batches.push((performance.now() - start) / 1000);
    }
    const intervals = [],
      draw = [];
    let previous = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 300; i++) {
      const now = await new Promise(requestAnimationFrame);
      if (i >= 10) intervals.push(now - previous);
      previous = now;
      const start = performance.now();
      w.select(i % 4);
      r.draw();
      draw.push(performance.now() - start);
    }
    const pacing = stats(intervals);
    const extension = r.gl.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio,
      canvas: [r.canvas.width, r.canvas.height],
      gpu: extension ? r.gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      ipc: ipcResult,
      sourceSwitch: {
        ...stats(batches),
        batchSize: 1000,
        note: 'Per-operation batch average, excludes DOM flush and draw; not an individual latency percentile',
      },
      drawSubmission: stats(draw),
      frameIntervals: {
        ...pacing,
        estimatedHz: 1000 / pacing.medianMs,
        intervalsOver1_5xMedian: intervals.filter((v) => v > pacing.medianMs * 1.5).length,
      },
      glError: r.gl.getError(),
    };
  });
  assert.equal(result.glError, 0);
  await writeFile(
    resolve(process.argv[2] || 'local-fixtures/native-benchmark.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
