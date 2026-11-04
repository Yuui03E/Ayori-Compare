<script lang="ts">
  import { Minus, Square, X, ScanLine, CircleHelp, House } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  import { controlWindow } from '../window-controls';
  let {
    onerror = (_: string) => {},
    children,
  }: { onerror?: (message: string) => void; children?: Snippet } = $props();
  async function control(action: 'minimize' | 'toggleMaximize' | 'close') {
    try {
      await controlWindow(action);
    } catch (error) {
      onerror(String(error));
    }
  }
</script>

<header
  data-tauri-drag-region
  data-hud
  class:comparing={w.comparing}
  class:micro={p.barHeight < 24}
>
  <div class="brand" data-tauri-drag-region>
    <ScanLine size={15} /><span data-tauri-drag-region>Ayori</span>
  </div>
  {#if w.comparing}<button
      class="home-button"
      aria-label="Home"
      data-tip={p.hint('home')}
      onclick={() => w.showHome()}><House size={14} /></button
    >{/if}
  {#if children}{@render children()}{/if}
  <div class="drag-space" data-tauri-drag-region></div>
  <div class="window-actions">
    <button
      class="settings"
      aria-label="Settings and shortcuts"
      data-tip={p.hint('settings')}
      onclick={() => (w.help = true)}><CircleHelp size={16} /></button
    >
    <button aria-label="Minimize" data-tip={p.hint('minimize')} onclick={() => control('minimize')}
      ><Minus size={14} /></button
    >
    <button
      aria-label="Maximize or restore"
      data-tip={p.hint('maximize')}
      onclick={() => control('toggleMaximize')}><Square size={11} /></button
    >
    <button
      class="close"
      aria-label="Close"
      data-tip={p.hint('quit')}
      onclick={() => control('close')}><X size={15} /></button
    >
  </div>
</header>

<style>
  header {
    position: absolute;
    inset: 0 0 auto;
    height: var(--bar-height);
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    user-select: none;
    background: #000;
    box-sizing: border-box;
    border-bottom: 0;
    box-shadow: inset 0 -1px #ffffff20;
    gap: 9px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 4px 0 13px;
    flex-shrink: 0;
    font-size: var(--bar-font-size);
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
    width: 28px;
    background: transparent;
    color: #9b9ba5;
  }
  .home-button {
    height: var(--bar-control-height);
    flex-shrink: 0;
    border-radius: 3px;
  }
  header :global(svg) {
    width: var(--bar-icon-size);
    height: var(--bar-icon-size);
    flex-shrink: 0;
  }
  button:focus-visible {
    outline-offset: -2px;
  }
  .micro .brand {
    gap: 4px;
  }
  .micro .brand :global(svg) {
    display: none;
  }
  button.settings {
    width: 28px;
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
