<script lang="ts">
  import { Minus, Square, X, ScanLine } from '@lucide/svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  let { onerror = (_: string) => {} }: { onerror?: (message: string) => void } = $props();
  async function control(action: 'minimize' | 'toggleMaximize' | 'close') {
    if (!isTauri()) return;
    try {
      await getCurrentWindow()[action]();
    } catch (error) {
      onerror(String(error));
    }
  }
</script>

<header data-tauri-drag-region>
  <div class="brand" data-tauri-drag-region>
    <ScanLine size={15} /><span data-tauri-drag-region
      >ayori<span class="muted"> / compare</span></span
    >
  </div>
  <div class="window-actions">
    <button aria-label="Minimize" title="Minimize" onclick={() => control('minimize')}
      ><Minus size={14} /></button
    >
    <button
      aria-label="Maximize or restore"
      title="Maximize or restore"
      onclick={() => control('toggleMaximize')}><Square size={11} /></button
    >
    <button class="close" aria-label="Close" title="Close" onclick={() => control('close')}
      ><X size={15} /></button
    >
  </div>
</header>

<style>
  header {
    position: absolute;
    inset: 0 0 auto;
    height: 32px;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;
    background: linear-gradient(#09090bd9, transparent);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    padding-left: 18px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.035em;
    color: #a7e5dc;
  }
  .window-actions {
    display: flex;
    height: 32px;
  }
  button {
    display: grid;
    place-items: center;
    width: 44px;
    background: transparent;
    color: #9b9ba5;
  }
  button:hover {
    background: #ffffff0c;
    color: white;
  }
  button.close:hover {
    background: #c42b3d;
  }
</style>
