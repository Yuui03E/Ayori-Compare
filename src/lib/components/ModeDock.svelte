<script lang="ts">
  import { Layers2, Columns2, PanelLeft, Scan, Waves, Grid2x2, CircleHelp } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
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
        data-tip={`${p.hint('mode' + i)}${w.mode === i ? '\nCurrent: ' + names[i][w.subMode] : ''}`}
        aria-pressed={w.mode === i}
        ><mode.icon size={18} strokeWidth={1.5} /><span class="mode-name">{mode.label}</span><span
          class="key-hint">{p.label('mode' + i)}</span
        ></button
      >{/each}
    <div class="rule"></div>
    <button
      class:active={w.grid}
      onclick={() => w.toggleGrid()}
      aria-label="Pixel grid and readout"
      data-tip={p.hint('grid')}
      aria-pressed={w.grid}
      ><Grid2x2 size={17} strokeWidth={1.5} /><span class="mode-name">Pixels</span><span
        class="key-hint">{p.label('grid')}</span
      ></button
    >
    <button
      onclick={() => (w.help = true)}
      aria-label="Keyboard shortcuts"
      data-tip={p.hint('settings')}
      ><CircleHelp size={17} strokeWidth={1.5} /><span class="mode-name">Shortcuts</span></button
    >
  </nav>
  {#if w.mode === 3 || w.mode === 4}<div class="adjust glass">
      <div>{names[w.mode][w.subMode]}</div>
      {#if w.mode === 3}<label
          >Gain <span class="mono">{w.gain}×</span><input
            aria-label="Difference gain"
            data-tip={`Amplify RGB or luma differences from 1× to 50×.\n${p.label('gainDown')} / ${p.label('gainUp')}`}
            type="range"
            min="1"
            max="50"
            value={w.gain}
            oninput={(e) => w.setGain(+e.currentTarget.value)}
          /></label
        >{:else if w.subMode === 0}<label
          >Frequency <span class="mono">{w.bands}×</span><input
            aria-label="Banding frequency"
            data-tip={`Change contour frequency from 8× to 64×.\n${p.label('bandsDown')} / ${p.label('bandsUp')}`}
            type="range"
            min="8"
            max="64"
            value={w.bands}
            oninput={(e) => w.setBands(+e.currentTarget.value)}
          /></label
        >{/if}<button onclick={() => w.setMode(w.mode)} data-tip={p.hint('mode' + w.mode)}
        >Cycle view <span class="mono">{p.label('mode' + w.mode)}</span></button
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
    width: 72px;
    height: 54px;
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
  .dock button .key-hint {
    max-width: 60px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    position: absolute;
    bottom: 3px;
    right: 4px;
    font:
      7px Consolas,
      monospace;
    opacity: 0.4;
  }
  .dock button .mode-name {
    font-size: 9px;
    margin-top: -5px;
    color: inherit;
  }
  @media (max-height: 760px) {
    .dock button {
      height: 44px;
      width: 60px;
    }
  }
  .dock button :global(svg) {
    margin-top: 5px;
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
