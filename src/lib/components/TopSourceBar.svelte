<script lang="ts">
  import {
    Plus,
    Search,
    FolderOpen,
    Images,
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Layers2,
    PanelLeft,
    Columns2,
    Scan,
    Waves,
    Grid2x2,
    Copy,
    Download,
    SlidersHorizontal,
    Maximize,
    RotateCcw,
    LoaderCircle,
  } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  import ControlPopover from './ControlPopover.svelte';
  import type { Mode } from '../types';
  let importing = $state(false),
    more = $state(false),
    query = $state('');
  let importButton = $state<HTMLButtonElement>(),
    moreButton = $state<HTMLButtonElement>(),
    sceneButton = $state<HTMLButtonElement>();
  const modes = [
    { icon: Layers2, label: 'Swap' },
    { icon: PanelLeft, label: 'Curtain' },
    { icon: Columns2, label: 'Split' },
    { icon: Scan, label: 'Difference' },
    { icon: Waves, label: 'Banding' },
  ];
  const names = [
    ['Instant swap'],
    ['Vertical wipe', 'Horizontal wipe', 'Four quadrants'],
    ['Side by side'],
    ['RGB difference', 'Luma heatmap'],
    ['Banding contours', 'Shadow boost', 'Luma plane', 'Chroma planes'],
  ];
  const imageCount = $derived(
    w.matrix?.scenes.reduce((n, s) => n + s.frames.filter(Boolean).length, 0) ?? 0,
  );
  const scenes = $derived(
    (w.matrix?.scenes ?? [])
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene, index }) =>
        `${index + 1} ${scene.label}`.toLowerCase().includes(query.toLowerCase()),
      ),
  );
  const size = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(0)} KB`;
  function sourceInfo(slot: number) {
    const frame = w.frames[slot],
      score = w.scores[slot];
    const details = frame
      ? `${frame.width} × ${frame.height} · ${frame.originalDepth}-bit · ${size(frame.fileSize)}`
      : w.pendingSlots.includes(slot) || w.loading
        ? 'Loading source…'
        : w.errors[slot]
          ? 'Unable to decode'
          : 'Missing in this scene';
    const metric =
      slot === 0
        ? 'Source 1 · scoring reference'
        : score?.score != null
          ? `SSIM2 ${score.score.toFixed(2)}${score.resampled ? ' · resized reference' : ''} · vs source 1 (RGB8)`
          : score?.error
            ? 'Score unavailable'
            : w.demo
              ? 'Procedural sample'
              : w.metricStatus || 'Score pending';
    return `${w.matrix?.sources[slot]?.label}\n${details}\n${metric}\nChoose A or B · ${p.label('sources')}`;
  }
  function open(folders: boolean, append = false) {
    importing = false;
    void w.choose(folders, append);
  }
</script>

<div class="toolbar" class:micro={p.barHeight < 24} data-hud aria-label="Comparison controls">
  <div class="pair">
    {#each [w.slotA, w.slotB] as slot, side}
      {#if side === 1}<button
          class="icon exchange"
          aria-label="Exchange A and B"
          data-tip={p.hint('exchange')}
          onclick={() => w.exchangeSources()}><ArrowLeftRight size={14} /></button
        >{/if}
      <button
        class="source-chip"
        class:secondary={side === 1}
        class:missing={!w.matrix?.scenes[w.sceneIndex]?.frames[slot]}
        aria-label={`Choose source ${side ? 'B' : 'A'}`}
        data-tip={`${side === 1 && w.slotA === w.slotB ? 'A and B are the same source. Choose another source to compare.\n' : ''}${sourceInfo(slot)}`}
        onclick={() => (w.sourceBrowser = true)}
      >
        <span class="badge">{side ? 'B' : 'A'}</span><span class="source-name"
          >{w.matrix?.sources[slot]?.label}</span
        >
        <small>{slot + 1}</small>{#if side === 1 && w.slotA === w.slotB}<span
            class="same-source"
            aria-label="A and B are the same source">=</span
          >{:else}<ChevronDown size={10} />{/if}
      </button>
    {/each}
  </div>
  <button
    class="icon browse"
    aria-label="Browse sources"
    data-tip={`${w.matrix?.sources.length} sources · ${imageCount} images\n${p.hint('sources')}`}
    onclick={() => (w.sourceBrowser = true)}
    ><Search size={14} /><span class="count">{w.matrix?.sources.length}</span></button
  >
  <span class="separator"></span>
  <nav class="modes" aria-label="Inspection modes">
    {#each modes as mode, i}<button
        class="icon"
        class:active={w.mode === i}
        aria-label={mode.label}
        aria-pressed={w.mode === i}
        data-tip={`${p.hint('mode' + i)}${w.mode === i ? '\nCurrent: ' + names[i][w.subMode] : ''}`}
        onclick={() => w.setMode(i as Mode)}><mode.icon size={16} strokeWidth={1.6} /></button
      >{/each}
  </nav>
  <span class="separator"></span>
  <div class="stepper">
    <button
      class="icon"
      aria-label="Previous scene"
      disabled={(w.matrix?.scenes.length ?? 0) < 2}
      data-tip={p.hint('previousScene')}
      onclick={() => w.scene(-1)}><ChevronLeft size={14} /></button
    >
    <button
      class="scene"
      bind:this={sceneButton}
      aria-label="Browse scenes"
      aria-haspopup="dialog"
      aria-expanded={w.drawer}
      data-tip={`${w.matrix?.scenes[w.sceneIndex]?.label}\n${p.hint('scenes')}`}
      popovertarget="scene-popover"
    >
      {#if w.loading}<LoaderCircle size={12} class="spinner" />{:else}<span class="scene-word"
          >Scene</span
        >{/if}
      <small class="mono">{w.sceneIndex + 1} / {w.matrix?.scenes.length}</small><ChevronDown
        size={10}
      />
    </button>
    <button
      class="icon"
      aria-label="Next scene"
      disabled={(w.matrix?.scenes.length ?? 0) < 2}
      data-tip={p.hint('nextScene')}
      onclick={() => w.scene(1)}><ChevronRight size={14} /></button
    >
  </div>
  <div class="view-tools">
    <button
      class="zoom mono"
      aria-label="Toggle fit and 100%"
      data-tip={`${Math.round(w.zoom * 100)}% · ${p.hint('toggleZoom')}`}
      onclick={() => w.toggleZoom()}>{Math.round(w.zoom * 100)}%</button
    >
    <button
      class="icon"
      class:active={w.grid}
      aria-label="Pixel grid and readout"
      aria-pressed={w.grid}
      data-tip={p.hint('grid')}
      onclick={() => w.toggleGrid()}><Grid2x2 size={15} /></button
    >
    <button
      class="icon copy"
      aria-label="Copy PNG"
      data-tip={p.hint('copy')}
      onclick={() => w.copy()}><Copy size={14} /></button
    >
    <button
      class="icon"
      bind:this={moreButton}
      aria-label="View options"
      aria-haspopup="dialog"
      aria-expanded={more}
      data-tip={`View options · ${names[w.mode][w.subMode]}\nZoom, filtering, effect adjustments and export.`}
      popovertarget="view-popover"><SlidersHorizontal size={15} /></button
    >
    <button
      class="icon"
      bind:this={importButton}
      aria-label="Import images or folders"
      aria-haspopup="dialog"
      aria-expanded={importing}
      data-tip="Open images, matched source folders, or add more sources."
      popovertarget="import-popover"><Plus size={17} /></button
    >
  </div>
</div>

<ControlPopover
  id="import-popover"
  bind:open={importing}
  anchor={importButton}
  label="Import comparison"
>
  <div class="menu-heading">IMPORT</div>
  <button class="menu-item" onclick={() => open(false)} data-tip={p.hint('openImages')}
    ><Images size={15} /><span>Open images<small>Alternatives of the same frame</small></span><kbd
      >{p.label('openImages')}</kbd
    ></button
  >
  <button class="menu-item" onclick={() => open(true)} data-tip={p.hint('openFolders')}
    ><FolderOpen size={15} /><span
      >Open source folders<small>One folder per release or encoding group</small></span
    ></button
  >
  <button
    class="menu-item"
    disabled={w.demo}
    onclick={() => open(w.matrix?.sources[0].kind === 'folder', true)}
    data-tip={p.hint('append')}
    ><Plus size={15} /><span>Add sources<small>Extend this comparison</small></span></button
  >
</ControlPopover>
<ControlPopover id="scene-popover" bind:open={w.drawer} anchor={sceneButton} label="Scenes">
  <div class="menu-heading">SCENES <span>{w.matrix?.scenes.length} matched frames</span></div>
  <input
    class="scene-search"
    aria-label="Search scenes"
    placeholder="Find a scene or frame…"
    bind:value={query}
  />
  {#each scenes as { scene, index }}<button
      class="scene-item"
      class:active={index === w.sceneIndex}
      onclick={() => {
        void w.loadScene(index);
        w.drawer = false;
      }}
      data-tip={`${scene.label}\nAvailable in ${scene.frames.filter(Boolean).length} of ${w.matrix?.sources.length} sources.`}
    >
      <span class="mono">{index + 1}</span><strong>{scene.label}</strong><small
        >{scene.frames.filter(Boolean).length}/{w.matrix?.sources.length}</small
      >
    </button>{/each}
  {#if !scenes.length}<p class="empty">No matching scenes.</p>{/if}
</ControlPopover>
<ControlPopover id="view-popover" bind:open={more} anchor={moreButton} label="View options">
  <div class="menu-heading">VIEW <span>{names[w.mode][w.subMode]}</span></div>
  <div class="presets">
    <button data-tip={p.hint('fit')} onclick={() => w.fit()}><Maximize size={12} /> Fit</button>
    {#each [1, 2, 4, 8] as zoom}<button
        class:active={Math.abs(w.zoom - zoom) < 0.001}
        data-tip={`Set physical pixel zoom to ${zoom * 100}%.`}
        onclick={() => w.setZoom(zoom)}>{zoom * 100}%</button
      >{/each}
  </div>
  <button class="menu-item" data-tip={p.hint('filter')} onclick={() => w.setFilter()}
    ><SlidersHorizontal size={14} /><span>Filtering</span><b
      >{w.filter === 'auto'
        ? `Auto · ${w.zoom >= 1 ? 'nearest' : 'smooth'}`
        : w.filter === 'nearest'
          ? 'Nearest'
          : 'Bilinear'}</b
    ></button
  >
  {#if [1, 3, 4].includes(w.mode)}<button
      class="menu-item"
      data-tip={p.hint('mode' + w.mode)}
      onclick={() => w.setMode(w.mode)}
      ><Layers2 size={14} /><span>Cycle {modes[w.mode].label.toLowerCase()} view</span><kbd
        >{p.label('mode' + w.mode)}</kbd
      ></button
    >{/if}
  {#if w.mode === 3}<label class="adjust"
      >Difference gain <b>{w.gain}×</b><input
        aria-label="Difference gain"
        type="range"
        min="1"
        max="50"
        value={w.gain}
        oninput={(e) => w.setGain(+e.currentTarget.value)}
      /></label
    >{/if}
  {#if w.mode === 4 && w.subMode === 0}<label class="adjust"
      >Contour frequency <b>{w.bands}×</b><input
        aria-label="Banding frequency"
        type="range"
        min="8"
        max="64"
        value={w.bands}
        oninput={(e) => w.setBands(+e.currentTarget.value)}
      /></label
    >{/if}
  <button class="menu-item" data-tip={p.hint('resetView')} onclick={() => w.resetView()}
    ><RotateCcw size={14} /><span>Reset view</span><kbd>{p.label('resetView')}</kbd></button
  >
  <div class="menu-rule"></div>
  <button
    class="menu-item"
    data-tip={p.hint('export')}
    onclick={() => {
      more = false;
      void w.exportHtml();
    }}><Download size={14} /><span>Export offline HTML</span><kbd>{p.label('export')}</kbd></button
  >
  <div class="workspace-info">
    {w.demo ? 'Sample' : 'Local workspace'} · {w.matrix?.sources.length} sources · {imageCount} images<br
    />{w.frames.filter(Boolean).length} ready · {w.loadMs.toFixed(0)} ms scene preparation<br
    />Source RGB · SDR interpretation
  </div>
</ControlPopover>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex: 1;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: var(--bar-control-height);
    border-radius: 5px;
    background: transparent;
    color: #91a6a2;
    font-size: var(--bar-font-size);
    line-height: 1;
    white-space: nowrap;
  }
  button:hover {
    color: #e3eee9;
    background: #9ce0cb12;
  }
  button.active {
    color: #b4f0dd;
    background: #8ce0c51c;
    box-shadow: inset 0 0 0 1px #8ce0c522;
  }
  .icon {
    min-width: 28px;
    padding: 0 6px;
    flex-shrink: 0;
  }
  .toolbar :global(svg) {
    max-width: var(--bar-icon-size);
    max-height: var(--bar-icon-size);
  }
  .toolbar button:focus-visible {
    outline-offset: -2px;
  }
  .same-source {
    font:
      11px Consolas,
      monospace;
    color: #e7cd9b;
  }
  .micro .source-chip small,
  .micro .scene-word,
  .micro .count {
    display: none;
  }
  .micro .badge {
    padding: 0 3px;
    font-size: 9px;
    line-height: 11px;
  }
  .micro .source-chip {
    border-radius: 2px;
  }
  .micro .scene small {
    font-size: 9px;
  }
  .pair {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 140px;
    flex: 1;
    max-width: 610px;
  }
  .source-chip {
    flex: 1;
    min-width: 0;
    padding: 0 7px;
    border: 1px solid #82d6c126;
    background: #000;
  }
  .source-chip.secondary {
    border-color: #d5b57526;
    background: #000;
  }
  .source-chip.missing {
    border-style: dashed;
    opacity: 0.65;
  }
  .badge {
    color: #a8e9d6;
    background: #82d6c119;
    border-radius: 3px;
    padding: 1px 4px;
    font:
      10px Consolas,
      monospace;
  }
  .secondary .badge {
    color: #e7cd9b;
    background: #d5b57519;
  }
  .source-name {
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    color: #cbddd5;
    flex: 1;
  }
  .source-chip small {
    font:
      9px Consolas,
      monospace;
    color: #748e84;
  }
  .source-chip :global(svg) {
    flex-shrink: 0;
  }
  .count {
    font:
      10px Consolas,
      monospace;
  }
  .modes,
  .stepper,
  .view-tools {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .separator {
    height: min(17px, calc(var(--bar-height) - 4px));
    width: 1px;
    background: #ffffff10;
    margin: 0 3px;
    flex-shrink: 0;
  }
  .scene {
    padding: 0 4px;
  }
  .scene small {
    color: #b1c5bc;
    font-size: 10px;
  }
  .zoom {
    min-width: 46px;
    color: #c2d4cc;
    padding: 0 5px;
  }
  .menu-heading {
    display: flex;
    justify-content: space-between;
    padding: 5px 7px 8px;
    color: #89b5a7;
    font-size: 9px;
    letter-spacing: 0.1em;
  }
  .menu-heading span {
    color: #839b94;
    letter-spacing: 0;
  }
  .menu-item {
    width: 100%;
    min-height: 34px;
    height: auto;
    padding: 8px;
    justify-content: flex-start;
    text-align: left;
    gap: 9px;
  }
  .menu-item span {
    flex: 1;
  }
  .menu-item small {
    display: block;
    color: #79928a;
    margin-top: 3px;
    font-size: 10px;
  }
  .menu-item b {
    font-size: 10px;
    font-weight: 400;
    color: #adc4b8;
  }
  kbd {
    font:
      9px Consolas,
      monospace;
    color: #7b998b;
  }
  .presets {
    display: flex;
    gap: 3px;
    padding: 0 4px 5px;
  }
  .presets button {
    flex: 1;
    font-size: 10px;
    background: #ffffff04;
  }
  .adjust {
    display: block;
    font-size: 11px;
    padding: 8px;
    color: #a6bbb1;
  }
  .adjust b {
    float: right;
    font:
      11px Consolas,
      monospace;
  }
  .adjust input {
    width: 100%;
    height: 4px;
    accent-color: #96d7be;
    margin-top: 12px;
  }
  .menu-rule {
    height: 1px;
    background: #ffffff0d;
    margin: 6px;
  }
  .workspace-info {
    color: #748f83;
    font-size: 10px;
    line-height: 1.6;
    border-top: 1px solid #ffffff0d;
    padding: 9px 8px 3px;
    margin-top: 5px;
  }
  .scene-search {
    width: 100%;
    background: #ffffff06;
    border: 1px solid #ffffff15;
    border-radius: 5px;
    padding: 8px;
    margin-bottom: 6px;
    color: #ceded5;
    font-size: 11px;
  }
  .scene-item {
    width: 100%;
    padding: 7px;
    height: 32px;
    text-align: left;
  }
  .scene-item strong {
    flex: 1;
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scene-item span,
  .scene-item small {
    font-size: 9px;
    color: #819d90;
  }
  .empty {
    font-size: 11px;
    padding: 8px;
    color: #82988d;
  }
  @media (max-width: 1150px) {
    .scene-word {
      display: none;
    }
    .toolbar {
      gap: 2px;
    }
    .separator {
      margin: 0 1px;
    }
    .source-chip {
      gap: 4px;
      padding: 0 5px;
    }
  }
  @media (max-width: 1000px) {
    .source-chip small {
      display: none;
    }
    .icon {
      min-width: 26px;
      padding: 0 5px;
    }
  }
</style>
