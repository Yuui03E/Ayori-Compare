import { Renderer } from './lib/webgl/renderer';
import { parseFrame, readPixel } from './lib/webgl/packet';
import type { Mode, Point } from './lib/types';

type Manifest = {
  sources: { label: string }[];
  scenes: { label: string; frames: (number | null)[] }[];
};
const manifest: Manifest = JSON.parse(document.getElementById('manifest')!.textContent!);
const packets: string[] = JSON.parse(document.getElementById('packets')!.textContent!);
const canvas = document.querySelector('canvas')!;
const status = document.getElementById('status')!,
  sources = document.getElementById('sources')!,
  sceneSelect = document.querySelector<HTMLSelectElement>('#scenes')!;
const pixelText = document.getElementById('pixels')!;
let scene = 0,
  generation = 0,
  previous = 1,
  pan: Point | null = null;
let renderer: Renderer;
function fail(error: unknown) {
  status.textContent = String(error);
}
try {
  renderer = new Renderer(canvas);
} catch (error) {
  fail(error);
  throw error;
}
const v = renderer.view;
renderer.onError = fail;
manifest.scenes.forEach((s, i) => {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = `${i + 1} / ${manifest.scenes.length} — ${s.label}`;
  sceneSelect.append(option);
});
manifest.sources.forEach((s, i) => {
  const button = document.createElement('button');
  button.textContent = `${i + 1}  ${s.label}`;
  button.title = 'Click: primary A · Right click: secondary B';
  button.onclick = () => select(i);
  button.oncontextmenu = (e) => {
    e.preventDefault();
    select(i, true);
  };
  sources.append(button);
});
function badges() {
  [...sources.children].forEach((el, i) => {
    el.classList.toggle('a', i === v.slotA);
    el.classList.toggle('b', i === v.slotB);
    el.classList.toggle('missing', !renderer.frames[i]);
  });
}
function select(slot: number, secondary = false) {
  if (slot < 0 || slot >= manifest.sources.length) return;
  if (secondary) v.slotB = slot;
  else {
    if (slot !== v.slotA) previous = v.slotA;
    v.slotA = slot;
  }
  badges();
  renderer.invalidate();
}
async function load(index: number) {
  const token = ++generation;
  scene = (index + manifest.scenes.length) % manifest.scenes.length;
  sceneSelect.value = String(scene);
  renderer.clear();
  status.textContent = 'Loading scene…';
  try {
    for (const [slot, id] of manifest.scenes[scene].frames.entries()) {
      if (id === null) continue;
      const bytes = Uint8Array.from(atob(packets[id]), (c) => c.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      const raw = await new Response(stream).arrayBuffer();
      if (token !== generation) return;
      renderer.upload(slot, parseFrame(raw));
    }
    if (token !== generation) return;
    badges();
    renderer.fit();
    status.textContent = renderer.fallback.some(Boolean)
      ? '8-bit preview · exact source readout retained'
      : 'Source RGB · SDR · exact decoded samples';
  } catch (error) {
    if (token === generation) fail(error);
  }
}
function mode(next: Mode) {
  const sub = v.mode === next ? (v.subMode + 1) % [1, 3, 1, 2, 4][next] : 0;
  renderer.setMode(next, sub);
  document
    .querySelectorAll<HTMLButtonElement>('[data-mode]')
    .forEach((el) => el.classList.toggle('active', Number(el.dataset.mode) === next));
}
sceneSelect.onchange = () => void load(+sceneSelect.value);
document.getElementById('prev')!.onclick = () => void load(scene - 1);
document.getElementById('next')!.onclick = () => void load(scene + 1);
document
  .querySelectorAll<HTMLButtonElement>('[data-mode]')
  .forEach((el) => (el.onclick = () => mode(+el.dataset.mode! as Mode)));
document
  .querySelectorAll<HTMLButtonElement>('[data-zoom]')
  .forEach(
    (el) =>
      (el.onclick = () =>
        Number(el.dataset.zoom) === 0 ? renderer.fit() : renderer.zoomTo(Number(el.dataset.zoom))),
  );
document.querySelector<HTMLInputElement>('#gain')!.oninput = (e) => {
  v.gain = +(e.target as HTMLInputElement).value;
  renderer.invalidate();
};
document.querySelector<HTMLInputElement>('#bands')!.oninput = (e) => {
  v.bandFrequency = +(e.target as HTMLInputElement).value;
  renderer.invalidate();
};
canvas.oncontextmenu = (e) => e.preventDefault();
canvas.onpointerdown = (e) => {
  canvas.setPointerCapture(e.pointerId);
  v.mouse = renderer.point(e);
  if (e.button === 2) v.loupe = true;
  else if (e.button === 1 || (e.button === 0 && (v.mode !== 1 || e.ctrlKey)))
    pan = renderer.point(e);
  renderer.invalidate();
};
canvas.onpointermove = (e) => {
  const next = renderer.point(e);
  if (pan) {
    renderer.panBy({ x: next.x - pan.x, y: next.y - pan.y });
    pan = next;
  }
  v.mouse = next;
  renderer.invalidate();
  if (v.grid) {
    const uv = renderer.uv();
    pixelText.textContent = [v.slotA, v.slotB]
      .map((slot, i) => {
        const frame = renderer.frames[slot],
          p = frame ? readPixel(frame, uv) : null;
        return p
          ? `${i ? 'B' : 'A'} (${p.x},${p.y}) RGB8 ${p.rgb8} · RGB10 ${p.rgb10} · ${p.hex}${p.depth === 16 ? ' · RAW16 ' + p.samples.slice(0, 3) : ''}`
          : `${i ? 'B' : 'A'} missing`;
      })
      .join(' | ');
  }
};
canvas.onpointerup = (e) => {
  pan = null;
  v.loupe = e.shiftKey;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  renderer.invalidate();
};
canvas.onpointercancel = () => {
  pan = null;
  v.loupe = false;
  renderer.invalidate();
};
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    renderer.zoomTo(v.zoom * (e.deltaY < 0 ? 1.25 : 0.8), renderer.point(e));
  },
  { passive: false },
);
window.onkeydown = (e) => {
  if ((e.target as HTMLElement).matches('input,select')) return;
  const key = e.key.toLowerCase();
  if (/^[1-8]$/.test(key)) {
    e.preventDefault();
    select(+key - 1, e.altKey);
  } else if (key === ' ') {
    e.preventDefault();
    select(previous);
  } else if (key === 'shift') {
    v.loupe = true;
    renderer.invalidate();
  } else if (key.length === 1 && 'msdfb'.includes(key)) {
    mode('msdfb'.indexOf(key) as Mode);
  } else if (key === 'z' || key === '0') {
    Math.abs(v.zoom - 1) < 0.001 ? renderer.fit() : renderer.zoomTo(1);
  } else if (key === 'g') {
    v.grid = !v.grid;
    if (!v.grid) pixelText.textContent = '';
    renderer.invalidate();
  } else if (key === 'h') {
    document.body.classList.toggle('hide-controls');
  } else if (['arrowup', 'arrowdown', '[', ']'].includes(key)) {
    e.preventDefault();
    void load(scene + (key === 'arrowup' || key === '[' ? -1 : 1));
  } else if (key === 'arrowleft' || key === 'arrowright') {
    e.preventDefault();
    select(
      (v.slotA + (key === 'arrowleft' ? -1 : 1) + manifest.sources.length) %
        manifest.sources.length,
    );
  }
};
window.onkeyup = (e) => {
  if (e.key === 'Shift') {
    v.loupe = false;
    renderer.invalidate();
  }
};
window.onblur = () => {
  pan = null;
  v.loupe = false;
  renderer.invalidate();
};
void load(0);
