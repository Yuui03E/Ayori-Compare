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
  import SourceBrowser from './lib/components/SourceBrowser.svelte';
  import Tooltip from './lib/components/Tooltip.svelte';
  import { preferences as p } from './lib/state/preferences.svelte';
  import { runCommand } from './lib/commands';
  import { workspace as w } from './lib/state/workspace.svelte';
  import type { Metric, Point } from './lib/types';
  let canvas: HTMLCanvasElement;
  let rendererError = $state('');
  let lastActivity = performance.now(),
    hoveringHud = false;
  let altHeld = $state(false);
  let pan: Point | null = null;
  let loupeKey = '';
  let rightHeld = false;
  const modeNames = ['Instant swap', 'Curtain', 'Side by side', 'Difference', 'Banding & planes'];
  function activity(event?: PointerEvent) {
    lastActivity = performance.now();
    if (event) hoveringHud = !!(event.target as Element)?.closest?.('[data-hud]');
    if (!w.hudLocked) w.hudHidden = false;
  }
  function keydown(event: KeyboardEvent) {
    altHeld = event.altKey;
    activity();
    if (w.help || w.sourceBrowser) return;
    if (event.key === 'Escape') {
      w.hudLocked = false;
      w.hudHidden = false;
      w.drawer = false;
      w.loupe(false);
      loupeKey = '';
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.closest('input,textarea,select,[contenteditable="true"]') ||
      target.isContentEditable
    )
      return;
    if (target.closest('button,a') && [' ', 'Enter'].includes(event.key)) return;
    const action = p.match(event);
    if (!action || (!w.matrix && !action.global)) return;
    event.preventDefault();
    if (event.repeat && !action.repeat) return;
    if (action.id === 'loupe') {
      loupeKey = event.code;
      w.loupe(true);
    } else runCommand(action.id);
  }
  function keyup(event: KeyboardEvent) {
    altHeld = event.altKey;
    if (
      loupeKey &&
      (event.code === loupeKey || ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key))
    ) {
      loupeKey = '';
      w.loupe(rightHeld);
    }
  }
  function blur() {
    altHeld = false;
    pan = null;
    loupeKey = '';
    rightHeld = false;
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
        rightHeld = true;
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
      if (e.button === 2 || e.type === 'pointercancel') {
        rightHeld = false;
        w.loupe(!!loupeKey);
      }
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
          p.autoHide &&
          !!w.matrix &&
          !hoveringHud &&
          !w.help &&
          !w.sourceBrowser &&
          !w.drawer &&
          performance.now() - lastActivity > 2500;
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
<canvas
  bind:this={canvas}
  class:idle={!w.matrix}
  aria-label="Image comparison viewport"
  tabindex="0"
></canvas>
{#if !w.matrix}<EmptyDropzone />{/if}
<div class="hud" class:hidden={w.hudHidden}>
  <Titlebar onerror={(message) => w.notify(message)} />
  {#if w.matrix}
    <TopSourceBar /><ModeDock /><BottomSceneBar />
    <div class="mode-label">
      {modeNames[w.mode]}<span
        >{w.mode === 0
          ? `${p.label('nextSource')} next source · ${p.label('flicker')} flicker`
          : `${p.label('loupe')} or right hold · dual loupe`}</span
      >
    </div>
    <div class="status-left">
      <i></i>{w.demo ? 'PROCEDURAL SAMPLE' : 'LOCAL WORKSPACE'}<span
        data-tip="RGB source samples are interpreted as SDR without ICC conversion; see keyboard help for precision details."
        >Source RGB · SDR</span
      >
    </div>
    <div class="status-right">
      {#if w.loading}<LoaderCircle size={10} class="spinner" /> Loading scene{:else}{w.frames.filter(
          Boolean,
        ).length} ready / {w.matrix.sources.length} sources <b>·</b>
        <span data-tip="Scene preparation including decode, transfer, and GPU upload"
          >{w.loadMs.toFixed(0)} ms</span
        >{/if}<b>·</b>{Math.round(w.zoom * 100)}%
    </div>
  {/if}
</div>
{#if w.fallback}<div
    class="precision"
    data-tip="This GPU uses 8-bit preview textures. Differences and effects use that preview precision. Exact decoded 16-bit source values remain available in the pixel readout."
  >
    8-bit preview · exact source readout retained
  </div>{/if}
{#if w.matrix && !w.loading && (!w.frames[w.slotA] || ([1, 2, 3].includes(w.mode) && !w.frames[w.slotB]))}<div
    class="missing-label"
  >
    {w.pendingSlots.includes(w.slotA) ||
    ([1, 2, 3].includes(w.mode) && w.pendingSlots.includes(w.slotB))
      ? 'Preparing selected image…'
      : w.errors[w.slotA] || w.errors[w.slotB]
        ? 'A selected image could not be decoded. See Browse sources for details.'
        : 'A selected source is missing from this scene.'}
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
<SourceBrowser />
<Tooltip />

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    outline: none;
    touch-action: none;
  }
  canvas.idle {
    visibility: hidden;
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
  @media (max-height: 760px) {
    .mode-label {
      display: none;
    }
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
