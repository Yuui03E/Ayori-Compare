import { Renderer } from './lib/webgl/renderer';
import { parseFrame, readPixel } from './lib/webgl/packet';
import type { Mode, Point } from './lib/types';
import { residentSlots } from './lib/residency';
import { RightButtonGesture, normalizeQuickZoom } from './lib/right-button-gesture';

type Manifest = {
  sources: { label: string }[];
  scenes: { label: string; frames: (number | null)[] }[];
};
const manifest: Manifest = JSON.parse(document.getElementById('manifest')!.textContent!);
const packets: string[] = JSON.parse(document.getElementById('packets')!.textContent!);
const sizes: [number, number][] = JSON.parse(document.getElementById('sizes')!.textContent!);
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
let wanted = new Set<number>();
const jobs = new Map<number, Promise<void>>();
let errors = new Set<number>();
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
canvas.tabIndex = 0;
renderer.onChange = updatePixels;
const quickZoomInput = document.querySelector<HTMLInputElement>('#quick-zoom')!;
let rightHeld = false,
  shiftHeld = false;
const rightGesture = new RightButtonGesture({
  enabled: () => true,
  hold: (active) => {
    rightHeld = active;
    v.loupe = active || shiftHeld;
    renderer.invalidate();
  },
  doubleClick: (point) =>
    renderer.toggleQuickZoom(
      normalizeQuickZoom(+quickZoomInput.value) / 100,
      renderer.point({ clientX: point.x, clientY: point.y }),
    ),
});
quickZoomInput.onchange = () => {
  quickZoomInput.value = String(normalizeQuickZoom(+quickZoomInput.value || 200));
  rightGesture.forgetClicks();
};
document.addEventListener(
  'pointerdown',
  (e) => {
    if (e.target !== canvas) rightGesture.cancel();
  },
  true,
);
renderer.onError = fail;
const picker = document.createElement('div');
picker.className = 'source-picker';
const search = document.createElement('input');
search.type = 'search';
search.placeholder = 'Find a source…';
search.setAttribute('aria-label', 'Search sources');
search.title = 'Filter sources by name or number.';
const pickA = document.createElement('select'),
  pickB = document.createElement('select');
pickA.setAttribute('aria-label', 'Source A');
pickB.setAttribute('aria-label', 'Source B');
pickA.title = 'Choose the primary image A.';
pickB.title = 'Choose the secondary image B.';
function options() {
  for (const [menu, slot, name] of [
    [pickA, v.slotA, 'A'],
    [pickB, v.slotB, 'B'],
  ] as const) {
    menu.replaceChildren();
    manifest.sources.forEach((source, i) => {
      if (
        i !== slot &&
        !`${i + 1} ${source.label}`.toLowerCase().includes(search.value.toLowerCase())
      )
        return;
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `${name}: ${i + 1} · ${source.label}`;
      menu.append(option);
    });
    menu.value = String(slot);
  }
}
search.oninput = options;
pickA.onchange = () => select(Number(pickA.value));
pickB.onchange = () => select(Number(pickB.value), true);
picker.append(search, pickA, pickB);
sources.before(picker);
if (manifest.sources.length > 8) sources.hidden = true;
options();
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
  options();
  [...sources.children].forEach((el, i) => {
    el.classList.toggle('a', i === v.slotA);
    el.classList.toggle('b', i === v.slotB);
    el.classList.toggle('missing', manifest.scenes[scene].frames[i] === null);
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
  void syncFrames();
}
async function load(index: number) {
  rightGesture.forgetClicks();
  const token = ++generation;
  scene = (index + manifest.scenes.length) % manifest.scenes.length;
  sceneSelect.value = String(scene);
  renderer.clear();
  jobs.clear();
  errors = new Set();
  const dimensions = manifest.scenes[scene].frames.flatMap((id) =>
    id === null ? [] : [sizes[id]],
  );
  renderer.setSceneSize(
    dimensions.reduce((m, s) => Math.max(m, s[0]), 1),
    dimensions.reduce((m, s) => Math.max(m, s[1]), 1),
  );
  status.textContent = 'Loading scene…';
  try {
    await syncFrames();
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
async function syncFrames() {
  const token = generation;
  const paths = manifest.scenes[scene].frames;
  wanted = new Set(
    residentSlots(
      manifest.sources.length,
      v.slotA,
      v.slotB,
      previous,
      v.mode === 1 && v.subMode === 2,
    ).filter((slot) => paths[slot] !== null),
  );
  renderer.frames.forEach((frame, slot) => {
    if (frame && !wanted.has(slot)) renderer.remove(slot);
  });
  while (token === generation) {
    for (const slot of wanted) {
      if (jobs.size >= 2) break;
      if (renderer.frames[slot] || errors.has(slot) || jobs.has(slot)) continue;
      const id = paths[slot]!;
      const job = (async () => {
        const bytes = Uint8Array.from(atob(packets[id]), (c) => c.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
        const raw = await new Response(stream).arrayBuffer();
        if (token === generation && wanted.has(slot)) renderer.upload(slot, parseFrame(raw));
      })()
        .catch((error) => {
          if (token === generation) {
            errors.add(slot);
            fail(error);
          }
        })
        .finally(() => {
          if (jobs.get(slot) === job) jobs.delete(slot);
        });
      jobs.set(slot, job);
    }
    if (!jobs.size) break;
    await Promise.race(jobs.values());
  }
  if (token === generation) {
    badges();
    status.textContent = errors.size
      ? `${errors.size} image(s) could not be loaded.`
      : renderer.fallback.some(Boolean)
        ? '8-bit preview · exact source readout retained'
        : `${manifest.sources.length} sources · ${renderer.frames.filter(Boolean).length} ready · Source RGB / SDR`;
  }
}
function mode(next: Mode) {
  const sub = v.mode === next ? (v.subMode + 1) % [1, 3, 1, 2, 4][next] : 0;
  rightGesture.forgetClicks();
  renderer.setMode(next, sub);
  void syncFrames();
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
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(e.pointerId);
  v.mouse = renderer.point(e);
  if (e.button === 2) {
    e.preventDefault();
    rightGesture.down({ x: e.clientX, y: e.clientY });
  } else {
    rightGesture.cancel();
  }
  if (e.button === 1 || (e.button === 0 && (v.mode !== 1 || e.ctrlKey))) pan = renderer.point(e);
  renderer.invalidate();
};
canvas.onpointermove = (e) => {
  rightGesture.move({ x: e.clientX, y: e.clientY }, e.buttons);
  const next = renderer.point(e);
  if (pan) {
    renderer.panBy({ x: next.x - pan.x, y: next.y - pan.y });
    pan = next;
  }
  v.mouse = next;
  renderer.invalidate();
};
function updatePixels() {
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
}
canvas.onpointerup = (e) => {
  pan = null;
  if (e.button === 2) rightGesture.up({ x: e.clientX, y: e.clientY });
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  renderer.invalidate();
};
canvas.onlostpointercapture = () => {
  if (rightGesture.pressed) rightGesture.cancel();
};
canvas.onpointercancel = () => {
  rightGesture.cancel();
  pan = null;
  v.loupe = shiftHeld;
  renderer.invalidate();
};
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    rightGesture.forgetClicks();
    renderer.zoomTo(v.zoom * (e.deltaY < 0 ? 1.25 : 0.8), renderer.point(e));
  },
  { passive: false },
);
window.onkeydown = (e) => {
  if ((e.target as HTMLElement).matches('input,select')) return;
  rightGesture.forgetClicks();
  const key = e.key.toLowerCase();
  if (/^[1-8]$/.test(key)) {
    e.preventDefault();
    select(+key - 1, e.altKey);
  } else if (key === ' ') {
    e.preventDefault();
    select(previous);
  } else if (key === 'shift') {
    shiftHeld = true;
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
    shiftHeld = false;
    v.loupe = rightHeld;
    renderer.invalidate();
  }
};
window.onblur = () => {
  shiftHeld = false;
  rightGesture.cancel();
  rightHeld = false;
  pan = null;
  v.loupe = false;
  renderer.invalidate();
};
void load(0);
