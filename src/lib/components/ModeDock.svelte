<script lang="ts">
  import { Layers2, Columns2, PanelLeft, Scan, Waves, Grid2x2, CircleHelp } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import type { Mode } from '../types';
  const modes = [
    { icon: Layers2, label: 'Swap', key: 'M' },
    { icon: PanelLeft, label: 'Curtain', key: 'S' },
    { icon: Columns2, label: 'Split', key: 'D' },
    { icon: Scan, label: 'Difference', key: 'F' },
    { icon: Waves, label: 'Banding', key: 'B' },
  ];
  const names = [
    ['Instant swap'],
    ['Vertical wipe', 'Horizontal wipe', 'Four quadrants'],
    ['Side by side'],
    ['RGB difference', 'Luma heatmap'],
    ['Banding contours', 'Shadow boost', 'Luma plane', 'Chroma planes'],
  ];
</script>

<div class="dock-wrap" data-hud>
  <nav class="dock glass" aria-label="Inspection modes">
    {#each modes as mode, i}<button
        class:active={w.mode === i}
        onclick={() => w.setMode(i as Mode)}
        aria-label={mode.label}
        title={`${mode.label} (${mode.key})${w.mode === i ? ' · ' + names[i][w.subMode] : ''}`}
        aria-pressed={w.mode === i}
        ><mode.icon size={18} strokeWidth={1.5} /><span>{mode.key}</span></button
      >{/each}
    <div class="rule"></div>
    <button
      class:active={w.grid}
      onclick={() => w.toggleGrid()}
      aria-label="Pixel grid and readout"
      title="Pixel grid and readout (G)"
      aria-pressed={w.grid}><Grid2x2 size={17} strokeWidth={1.5} /><span>G</span></button
    >
    <button
      onclick={() => (w.help = true)}
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts (?)"><CircleHelp size={17} strokeWidth={1.5} /></button
    >
  </nav>
  {#if w.mode === 3 || w.mode === 4}<div class="adjust glass">
      <div>{names[w.mode][w.subMode]}</div>
      {#if w.mode === 3}<label
          >Gain <span class="mono">{w.gain}×</span><input
            aria-label="Difference gain"
            type="range"
            min="1"
            max="50"
            value={w.gain}
            oninput={(e) => w.setGain(+e.currentTarget.value)}
          /></label
        >{:else if w.subMode === 0}<label
          >Frequency <span class="mono">{w.bands}×</span><input
            aria-label="Banding frequency"
            type="range"
            min="8"
            max="64"
            value={w.bands}
            oninput={(e) => w.setBands(+e.currentTarget.value)}
          /></label
        >{/if}<button onclick={() => w.setMode(w.mode)}
        >Cycle view <span class="mono">{w.mode === 3 ? 'F' : 'B'}</span></button
      >
    </div>{/if}
</div>

<style>
  .dock-wrap {
    position: absolute;
    left: 22px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dock {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px;
    border-radius: 12px;
  }
  .dock button {
    width: 40px;
    height: 42px;
    position: relative;
    background: transparent;
    border-radius: 7px;
    color: #7b838c;
    display: grid;
    place-items: center;
  }
  .dock button:hover {
    background: #ffffff0a;
    color: #d0dad6;
  }
  .dock button.active {
    background: #8fe3cc12;
    color: #a0e5d6;
    box-shadow: inset 0 0 0 1px #8fe3cc18;
  }
  .dock button span {
    position: absolute;
    bottom: 3px;
    right: 4px;
    font:
      7px Consolas,
      monospace;
    opacity: 0.4;
  }
  .rule {
    height: 1px;
    background: #ffffff09;
    margin: 5px;
  }
  .adjust {
    border-radius: 10px;
    padding: 14px;
    width: 160px;
    font-size: 10px;
    color: #919c9c;
  }
  .adjust > div {
    color: #d0dad6;
    font-size: 11px;
    margin-bottom: 14px;
  }
  .adjust label {
    display: block;
  }
  .adjust span {
    float: right;
    color: #c1d5cb;
  }
  .adjust input {
    width: 100%;
    height: 3px;
    accent-color: #94dac7;
    margin: 16px 0;
  }
  .adjust button {
    display: block;
    background: none;
    color: #8f9e99;
    font-size: 10px;
    padding: 4px 0;
    width: 100%;
    text-align: left;
  }
</style>
