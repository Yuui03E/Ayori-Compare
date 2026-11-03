<script lang="ts">
  import { onMount } from 'svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { listen } from '@tauri-apps/api/event';
  import { X, Upload, LoaderCircle } from '@lucide/svelte';
  import Titlebar from './lib/components/Titlebar.svelte';
  import EmptyDropzone from './lib/components/EmptyDropzone.svelte';
  import TopSourceBar from './lib/components/TopSourceBar.svelte';
  import ModeDock from './lib/components/ModeDock.svelte';
  import BottomSceneBar from './lib/components/BottomSceneBar.svelte';
  import PixelReadout from './lib/components/PixelReadout.svelte';
  import HelpDialog from './lib/components/HelpDialog.svelte';
  import { workspace as w } from './lib/state/workspace.svelte';
  import type { Metric, Mode, Point } from './lib/types';
  let canvas: HTMLCanvasElement;
  let rendererError = $state('');
  let lastActivity = performance.now(),
    hoveringHud = false;
  let altHeld = $state(false);
  let pan: Point | null = null;
  const modeNames = ['Instant swap', 'Curtain', 'Side by side', 'Difference', 'Banding & planes'];
  function activity(event?: PointerEvent) {
    lastActivity = performance.now();
    if (event) hoveringHud = !!(event.target as Element)?.closest?.('[data-hud]');
    if (!w.hudLocked) w.hudHidden = false;
  }
  function keydown(event: KeyboardEvent) {
    altHeld = event.altKey;
    activity();
    if (w.help) return;
    const target = event.target as HTMLElement;
    if (target.matches('input,textarea,select') || target.isContentEditable) return;
    if (event.key === '?' || event.key === 'F1') {
      event.preventDefault();
      w.help = true;
      return;
    }
    if (!w.matrix) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'c') {
      event.preventDefault();
      void w.copy();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'e') {
      event.preventDefault();
      void w.exportHtml();
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    if (/^[1-8]$/.test(key)) {
      event.preventDefault();
      w.select(+key - 1, event.altKey);
      return;
    }
    if (key === 'shift') {
      w.loupe(true);
      return;
    }
    if (key === 'arrowleft' || key === 'arrowright') {
      event.preventDefault();
      w.cycleSource(key === 'arrowleft' ? -1 : 1);
      return;
    }
    if (['arrowup', 'arrowdown', '[', ']'].includes(key)) {
      event.preventDefault();
      w.scene(key === 'arrowup' || key === '[' ? -1 : 1);
      return;
    }
    if (event.repeat) return;
    if (key === ' ') {
      event.preventDefault();
      w.swap();
    } else if ('msdfb'.includes(key) && key.length === 1) {
      event.preventDefault();
      w.setMode('msdfb'.indexOf(key) as Mode);
    } else if (key === 'z' || key === '0') {
      event.preventDefault();
      w.toggleZoom();
    } else if (key === 'g') w.toggleGrid();
    else if (key === 'h') w.toggleHud();
  }
  function keyup(event: KeyboardEvent) {
    altHeld = event.altKey;
    if (event.key === 'Shift') w.loupe(false);
  }
  function blur() {
    altHeld = false;
    pan = null;
    w.loupe(false);
  }
  onMount(() => {
    try {
      w.attach(canvas);
    } catch (error) {
      rendererError = String(error);
      return;
    }
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const down = (e: PointerEvent) => {
      if (!w.matrix) return;
      canvas.focus({ preventScroll: true });
      w.move(e);
      if (e.button === 2) {
        w.loupe(true);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (e.button === 1 || (e.button === 0 && (w.mode !== 1 || e.ctrlKey))) {
        pan = w.renderer!.point(e);
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };
    const move = (e: PointerEvent) => {
      if (pan) {
        const next = w.renderer!.point(e);
        w.renderer!.panBy({ x: next.x - pan.x, y: next.y - pan.y });
        pan = next;
      }
      w.move(e);
    };
    const up = (e: PointerEvent) => {
      pan = null;
      if (e.button === 2) w.loupe(e.shiftKey);
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      if (!w.matrix) return;
      e.preventDefault();
      activity();
      w.renderer!.zoomTo(w.zoom * (e.deltaY < 0 ? 1.25 : 0.8), w.renderer!.point(e));
      w.updatePixel();
    };
    const context = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', context);
    const idle = setInterval(() => {
      if (!w.hudLocked)
        w.hudHidden =
          !!w.matrix && !hoveringHud && !w.help && performance.now() - lastActivity > 2500;
    }, 250);
    if (isTauri()) {
      let lastDrop = 0,
        lastPaths = '';
      void getCurrentWebview()
        .onDragDropEvent((event) => {
          const e = event.payload;
          if (e.type === 'enter' || e.type === 'over') w.draggingFiles = true;
          else w.draggingFiles = false;
          if (e.type === 'drop') {
            const signature = JSON.stringify(e.paths),
              now = performance.now();
            if (signature === lastPaths && now - lastDrop < 250) return;
            lastDrop = now;
            lastPaths = signature;
            void w.importPaths(e.paths, altHeld);
          }
        })
        .then((unlisten) => (disposed ? unlisten() : cleanups.push(unlisten)))
        .catch((error) => w.notify(String(error)));
      void listen<{ epoch: number; path: string }>('frame-changed', (event) =>
        w.onFileChanged(event.payload),
      ).then((unlisten) => (disposed ? unlisten() : cleanups.push(unlisten)));
      void listen<Metric & { epoch: number; revision: number }>('metric-ready', (event) =>
        w.onMetric(event.payload),
      ).then((unlisten) => (disposed ? unlisten() : cleanups.push(unlisten)));
    }
    return () => {
      disposed = true;
      clearInterval(idle);
      cleanups.forEach((fn) => fn());
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', context);
      w.dispose();
    };
  });
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onpointermove={activity} onblur={blur} />
<canvas bind:this={canvas} aria-label="Image comparison viewport" tabindex="0"></canvas>
{#if !w.matrix}<EmptyDropzone />{/if}
<div class="hud" class:hidden={w.hudHidden}>
  <Titlebar onerror={(message) => w.notify(message)} />
  {#if w.matrix}
    <TopSourceBar /><ModeDock /><BottomSceneBar />
    <div class="mode-label">
      {modeNames[w.mode]}<span
        >{w.mode === 0 ? '1–8 to switch · Space to flicker' : 'Hold Shift for dual loupe'}</span
      >
    </div>
    <div class="status-left">
      <i></i>{w.demo ? 'PROCEDURAL SAMPLE' : 'LOCAL WORKSPACE'}<span
        title="RGB source samples are interpreted as SDR without ICC conversion; see keyboard help for precision details."
        >Source RGB · SDR</span
      >
    </div>
    <div class="status-right">
      {#if w.loading}<LoaderCircle size={10} class="spinner" /> Loading scene{:else}{w.frames.filter(
          Boolean,
        ).length} sources <b>·</b>
        <span title="Scene preparation including decode, transfer, and GPU upload"
          >{w.loadMs.toFixed(0)} ms</span
        >{/if}<b>·</b>{Math.round(w.zoom * 100)}%
    </div>
  {/if}
</div>
{#if w.fallback}<div
    class="precision"
    title="This GPU uses 8-bit preview textures. Differences and effects use that preview precision. Exact decoded 16-bit source values remain available in the pixel readout."
  >
    8-bit preview · exact source readout retained
  </div>{/if}
{#if w.matrix && !w.loading && (!w.frames[w.slotA] || ([1, 2, 3].includes(w.mode) && !w.frames[w.slotB]))}<div
    class="missing-label"
  >
    A selected source is missing from this scene.
  </div>{/if}
<PixelReadout />
{#if w.message}<div class="toast glass" role="status">
    <span>{w.message}</span><button
      aria-label="Dismiss notification"
      onclick={() => (w.message = '')}><X size={14} /></button
    >
  </div>{/if}
{#if rendererError}<div class="error glass" role="alert">
    <h2>Unable to start the viewport</h2>
    <p>{rendererError}</p>
  </div>{/if}
{#if w.draggingFiles}<div class="drop-overlay">
    <Upload size={34} />
    <h2>{altHeld ? 'Add comparison sources' : 'Drop to compare'}</h2>
    <p>
      {altHeld ? 'Append to the current matrix' : 'Images for one scene · Folders for a sequence'}
    </p>
  </div>{/if}
<HelpDialog />

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    outline: none;
    touch-action: none;
  }
  .hud {
    transition: opacity 250ms cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: none;
  }
  .hud :global([data-hud]),
  .hud :global(header) {
    pointer-events: auto;
  }
  .hud.hidden {
    opacity: 0;
  }
  .hud.hidden :global(*) {
    pointer-events: none !important;
  }
  .mode-label {
    position: absolute;
    left: 25px;
    bottom: 99px;
    font-size: 11px;
    letter-spacing: 0.015em;
    color: #82918f;
  }
  .mode-label span {
    display: block;
    font-size: 9px;
    margin-top: 5px;
    color: #536461;
  }
  .status-left,
  .status-right {
    position: absolute;
    bottom: 15px;
    font-size: 8px;
    color: #5c6f68;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: Consolas, monospace;
  }
  .status-left {
    left: 25px;
    letter-spacing: 0.07em;
  }
  .status-left i {
    height: 4px;
    width: 4px;
    border-radius: 50%;
    background: #629b7f;
  }
  .status-left span {
    margin-left: 13px;
    letter-spacing: 0;
    color: #4e605b;
  }
  .status-right {
    right: 25px;
    color: #70877d;
  }
  .status-right b {
    font-weight: 400;
    color: #344d42;
  }
  .precision {
    position: absolute;
    right: 22px;
    top: 42px;
    font:
      9px Consolas,
      monospace;
    color: #d9b575;
    background: #251e16dc;
    padding: 6px 9px;
    border: 1px solid #a6864233;
    border-radius: 5px;
  }
  .missing-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #101816c9;
    border: 1px solid #74968630;
    border-radius: 8px;
    padding: 14px 20px;
    color: #a8b7ad;
    font-size: 12px;
    pointer-events: none;
  }
  .toast {
    position: absolute;
    z-index: 50;
    bottom: 110px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 20px;
    align-items: start;
    max-width: 650px;
    max-height: 200px;
    overflow: auto;
    padding: 14px 16px;
    border-radius: 9px;
    font-size: 11px;
    line-height: 1.6;
    color: #c9d8cd;
  }
  .toast button {
    background: none;
    color: #80998a;
    padding: 0;
  }
  .error {
    position: absolute;
    inset: 35% 20% auto;
    padding: 28px;
    border-radius: 12px;
    font-size: 13px;
    color: #dababc;
  }
  .drop-overlay {
    position: absolute;
    inset: 42px 16px 16px;
    border: 1px dashed #a0debd;
    border-radius: 17px;
    background: #101b17ee;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #b7e6c9;
    pointer-events: none;
    backdrop-filter: blur(10px);
  }
  .drop-overlay h2 {
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.035em;
  }
  .drop-overlay p {
    font-size: 12px;
    color: #869f91;
  }
  :global(.spinner) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
