<script lang="ts">
  import { onMount } from 'svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { listen } from '@tauri-apps/api/event';
  import { X, Upload } from '@lucide/svelte';
  import Titlebar from './lib/components/Titlebar.svelte';
  import EmptyDropzone from './lib/components/EmptyDropzone.svelte';
  import TopSourceBar from './lib/components/TopSourceBar.svelte';
  import PixelReadout from './lib/components/PixelReadout.svelte';
  import HelpDialog from './lib/components/HelpDialog.svelte';
  import SourceBrowser from './lib/components/SourceBrowser.svelte';
  import Tooltip from './lib/components/Tooltip.svelte';
  import { preferences as p } from './lib/state/preferences.svelte';
  import { runCommand } from './lib/commands';
  import { workspace as w } from './lib/state/workspace.svelte';
  import type { Metric, Point } from './lib/types';
  import { RightButtonGesture } from './lib/right-button-gesture';
  let canvas: HTMLCanvasElement;
  let rendererError = $state('');
  let lastActivity = performance.now(),
    hoveringHud = false;
  let altHeld = $state(false);
  let pan: Point | null = null;
  let loupeKey = '';
  let rightHeld = false;
  const rightGesture = new RightButtonGesture({
    enabled: () => p.doubleRightZoom,
    hold: (active) => {
      rightHeld = active;
      w.loupe(active || !!loupeKey);
    },
    doubleClick: (point) => {
      if (!w.comparing || w.help || w.sourceBrowser || !w.renderer) return;
      w.renderer.toggleQuickZoom(
        p.quickZoomPercent / 100,
        w.renderer.point({ clientX: point.x, clientY: point.y }),
      );
      w.updatePixel();
    },
  });
  $effect(() => {
    if (!w.comparing || w.help || w.sourceBrowser) blur();
  });
  $effect(() => {
    // A click begun on another scene, mode or preference cannot finish a double click here.
    void [w.matrix, w.sceneIndex, w.mode, w.subMode, p.doubleRightZoom, p.quickZoomPercent];
    rightGesture.forgetClicks();
  });
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
      rightGesture.cancel();
      w.hudLocked = false;
      w.hudHidden = false;
      w.drawer = false;
      w.loupe(false);
      loupeKey = '';
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('[popover]:popover-open')) return;
    if (
      target.closest('input,textarea,select,[contenteditable="true"]') ||
      target.isContentEditable
    )
      return;
    if (target.closest('button,a') && [' ', 'Enter'].includes(event.key)) return;
    const action = p.match(event);
    if (!action || (!w.comparing && !action.global)) return;
    event.preventDefault();
    if (event.repeat && !action.repeat) return;
    rightGesture.forgetClicks();
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
    rightGesture.cancel();
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
      if (!w.comparing) return;
      canvas.focus({ preventScroll: true });
      w.move(e);
      if (e.button === 2) {
        e.preventDefault();
        rightGesture.down({ x: e.clientX, y: e.clientY });
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      rightGesture.cancel();
      if (e.button === 1 || (e.button === 0 && (w.mode !== 1 || e.ctrlKey))) {
        pan = w.renderer!.point(e);
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };
    const move = (e: PointerEvent) => {
      if (!w.comparing) return;
      rightGesture.move({ x: e.clientX, y: e.clientY }, e.buttons);
      if (pan) {
        const next = w.renderer!.point(e);
        w.renderer!.panBy({ x: next.x - pan.x, y: next.y - pan.y });
        pan = next;
      }
      w.move(e);
    };
    const up = (e: PointerEvent) => {
      pan = null;
      if (e.type === 'pointercancel') rightGesture.cancel();
      else if (e.button === 2) rightGesture.up({ x: e.clientX, y: e.clientY });
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      if (!w.comparing) return;
      rightGesture.forgetClicks();
      e.preventDefault();
      activity();
      w.renderer!.zoomTo(w.zoom * (e.deltaY < 0 ? 1.25 : 0.8), w.renderer!.point(e));
      w.updatePixel();
    };
    const context = (e: Event) => e.preventDefault();
    const lostCapture = () => {
      if (rightGesture.pressed) rightGesture.cancel();
    };
    const outsideDown = (e: PointerEvent) => {
      if (e.target !== canvas) rightGesture.cancel();
    };
    document.addEventListener('pointerdown', outsideDown, true);
    canvas.addEventListener('lostpointercapture', lostCapture);
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
          w.comparing &&
          !hoveringHud &&
          !document.activeElement?.closest('[data-hud]') &&
          !document.querySelector('[popover=auto]:popover-open') &&
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
      document.removeEventListener('pointerdown', outsideDown, true);
      canvas.removeEventListener('lostpointercapture', lostCapture);
      rightGesture.cancel();
      w.dispose();
    };
  });
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onpointermove={activity} onblur={blur} />
<div
  class="application"
  style:--bar-height={`${p.barHeight}px`}
  style:--bar-control-height={`${Math.max(14, p.barHeight - 8)}px`}
  style:--bar-icon-size={`${p.barHeight < 24 ? 12 : 15}px`}
  style:--bar-font-size={`${p.barHeight < 24 ? 9 : 11}px`}
>
  <canvas
    bind:this={canvas}
    class:idle={!w.comparing}
    aria-label="Image comparison viewport"
    tabindex="0"
  ></canvas>
  {#if !w.comparing}<EmptyDropzone />{/if}
  <div class="hud" class:hidden={w.hudHidden}>
    <Titlebar onerror={(message) => w.notify(message)}>
      {#if w.comparing}<TopSourceBar />{/if}
    </Titlebar>
  </div>
  {#if w.comparing && w.fallback}<div
      class="precision"
      data-tip="This GPU uses 8-bit preview textures. Differences and effects use that preview precision. Exact decoded 16-bit source values remain available in the pixel readout."
    >
      8-bit preview · exact source readout retained
    </div>{/if}
  {#if w.comparing && !w.loading && (!w.frames[w.slotA] || ([1, 2, 3].includes(w.mode) && !w.frames[w.slotB]))}<div
      class="missing-label"
    >
      {w.pendingSlots.includes(w.slotA) ||
      ([1, 2, 3].includes(w.mode) && w.pendingSlots.includes(w.slotB))
        ? 'Preparing selected image…'
        : w.errors[w.slotA] || w.errors[w.slotB]
          ? 'A selected image could not be decoded. See Browse sources for details.'
          : 'A selected source is missing from this scene.'}
    </div>{/if}
  {#if w.comparing}<PixelReadout />{/if}
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
</div>

<style>
  .application {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
  }
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
  .precision {
    position: absolute;
    right: 22px;
    top: calc(var(--bar-height) + 8px);
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
    bottom: 24px;
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
    inset: calc(var(--bar-height) + 8px) 16px 16px;
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
