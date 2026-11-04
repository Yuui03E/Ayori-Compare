<script lang="ts">
  import { Minus, Square, X, ScanLine, CircleHelp } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  let {
    onerror = (_: string) => {},
    children,
  }: { onerror?: (message: string) => void; children?: Snippet } = $props();
  async function control(action: 'minimize' | 'toggleMaximize' | 'close') {
    if (!isTauri()) return;
    try {
      await getCurrentWindow()[action]();
    } catch (error) {
      onerror(String(error));
    }
  }
</script>

<header data-tauri-drag-region data-hud class:comparing={!!w.matrix}>
  <div class="brand" data-tauri-drag-region>
    <ScanLine size={15} /><span data-tauri-drag-region>ayori</span>
  </div>
  {#if children}{@render children()}{/if}
  <div class="drag-space" data-tauri-drag-region></div>
  <div class="window-actions">
    <button
      class="settings"
      aria-label="Settings and shortcuts"
      data-tip={p.hint('settings')}
      onclick={() => (w.help = true)}><CircleHelp size={16} /></button
    >
    <button aria-label="Minimize" data-tip="Minimize" onclick={() => control('minimize')}
      ><Minus size={14} /></button
    >
    <button
      aria-label="Maximize or restore"
      data-tip="Maximize or restore"
      onclick={() => control('toggleMaximize')}><Square size={11} /></button
    >
    <button class="close" aria-label="Close" data-tip="Close" onclick={() => control('close')}
      ><X size={15} /></button
    >
  </div>
</header>

<style>
  header {
    position: absolute;
    inset: 0 0 auto;
    height: 44px;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;
    background: linear-gradient(110deg, #14201ff5, #101317f7);
    border-bottom: 1px solid #b9e6d71a;
    box-shadow: 0 2px 12px #0004;
    gap: 9px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 4px 0 13px;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.035em;
    color: #a7e5dc;
  }
  .comparing .drag-space {
    flex: 0;
  }
  .window-actions {
    display: flex;
    height: 100%;
    flex-shrink: 0;
  }
  .drag-space {
    min-width: 16px;
    flex: 1;
    height: 100%;
  }
  button {
    display: grid;
    place-items: center;
    width: 32px;
    background: transparent;
    color: #9b9ba5;
  }
  button.settings {
    width: 32px;
    display: flex;
    gap: 7px;
    padding: 0 8px;
    color: #9abdb3;
    border-right: 1px solid #ffffff0c;
    font-size: 10px;
  }
  button:hover {
    background: #ffffff0c;
    color: white;
  }
  button.close:hover {
    background: #c42b3d;
  }
  @media (max-width: 1150px) {
    header {
      gap: 5px;
    }
    .brand {
      padding-left: 9px;
      gap: 5px;
    }
    .drag-space {
      min-width: 8px;
    }
  }
</style>
