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
    Check,
    CircleAlert,
  } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  let importing = $state(false);
  const size = (bytes: number) =>
    bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
  const imageCount = $derived(
    w.matrix?.scenes.reduce((sum, scene) => sum + scene.frames.filter(Boolean).length, 0) ?? 0,
  );
  function open(folders: boolean, append = false) {
    importing = false;
    void w.choose(folders, append);
  }
</script>

<div class="source-island glass" data-hud>
  <div class="caption">
    <span>COMPARISON <b>{w.matrix?.sources.length} sources <i>·</i> {imageCount} images</b></span>
    <div class="tools">
      <button
        aria-label="Browse sources"
        data-tip={p.hint('sources')}
        onclick={() => (w.sourceBrowser = true)}
        ><Search size={13} /> Browse all <kbd>{p.label('sources')}</kbd></button
      ><button
        aria-label="Import images or folders"
        aria-expanded={importing}
        data-tip="Start a comparison from images or matched source folders, or add to the current comparison."
        onclick={() => (importing = !importing)}
        ><Plus size={14} /> Import <ChevronDown size={11} /></button
      >
    </div>
  </div>
  {#if importing}<div class="import-menu glass">
      <button onclick={() => open(false)} data-tip={p.hint('openImages')}
        ><Images size={15} /><span>Open images<small>Alternatives of one frame</small></span><kbd
          >{p.label('openImages')}</kbd
        ></button
      ><button onclick={() => open(true)} data-tip={p.hint('openFolders')}
        ><FolderOpen size={15} /><span
          >Open source folders<small>Match a sequence across releases</small></span
        ></button
      ><button
        disabled={w.demo}
        onclick={() => open(w.matrix?.sources[0].kind === 'folder', true)}
        data-tip={p.hint('append')}
        ><Plus size={15} /><span>Add sources<small>Extend this comparison</small></span></button
      >
    </div>{/if}
  <div class="pair">
    {#each [w.slotA, w.slotB] as slot, side}
      {#if side === 1}<button
          class="exchange"
          aria-label="Exchange A and B"
          data-tip={p.hint('exchange')}
          onclick={() => w.exchangeSources()}><ArrowLeftRight size={16} /></button
        >{/if}
      <div class="selection" class:secondary={side === 1}>
        <div class="selection-heading">
          <span class="badge">{side ? 'B' : 'A'}</span><span>{side ? 'COMPARISON' : 'PRIMARY'}</span
          >
          <div class="arrows">
            <button
              aria-label={`Previous source ${side ? 'B' : 'A'}`}
              data-tip={p.hint(side ? 'previousB' : 'previousSource')}
              onclick={() => w.cycleSource(-1, !!side)}><ChevronLeft size={12} /></button
            ><span>{slot + 1}/{w.matrix?.sources.length}</span><button
              aria-label={`Next source ${side ? 'B' : 'A'}`}
              data-tip={p.hint(side ? 'nextB' : 'nextSource')}
              onclick={() => w.cycleSource(1, !!side)}><ChevronRight size={12} /></button
            >
          </div>
        </div>
        <button
          class="source-name"
          aria-label={`Choose source ${side ? 'B' : 'A'}`}
          data-tip={`${w.matrix?.sources[slot]?.label}\nBrowse every source and assign A or B.\n${p.label('sources')}`}
          onclick={() => (w.sourceBrowser = true)}
          ><strong>{w.matrix?.sources[slot]?.label}</strong><ChevronDown size={12} /></button
        >
        <div class="metadata mono">
          {#if w.frames[slot]}{@const frame = w.frames[slot]!}<span
              >{frame.width} × {frame.height} · {frame.originalDepth}-bit · {size(
                frame.fileSize,
              )}</span
            >{:else}<span
              >{w.pendingSlots.includes(slot) || w.loading
                ? 'Loading source…'
                : w.errors[slot]
                  ? 'Unable to decode'
                  : 'Missing in this scene'}</span
            >{/if}
        </div>
        <div class="score-line">
          {#if slot === 0}<span class="reference"><Check size={10} /> Reference source</span
            >{:else if w.scores[slot]?.score != null}<span
              data-tip="SSIMULACRA2 against source 1, using RGB8 sRGB. An asterisk means the reference was resized using Catmull-Rom."
              >SSIM2 <b>{w.scores[slot].score!.toFixed(2)}{w.scores[slot].resampled ? ' *' : ''}</b
              ></span
            >{:else if w.scores[slot]?.error}<span data-tip={w.scores[slot].error}
              >Score unavailable</span
            >{:else}<span
              >{w.demo ? 'Procedural sample' : w.metricStatus || 'Compared against source 1'}</span
            >{/if}
        </div>
      </div>
    {/each}
  </div>
  {#if (w.matrix?.sources.length ?? 0) <= 8}<div
      class="sources"
      aria-label="Quick source selection"
    >
      {#each w.matrix?.sources ?? [] as source, i}<button
          class="source"
          class:active={w.slotA === i}
          class:secondary={w.slotB === i}
          class:missing={!w.matrix?.scenes[w.sceneIndex].frames[i]}
          onclick={() => w.select(i)}
          oncontextmenu={(e) => {
            e.preventDefault();
            w.select(i, true);
          }}
          data-tip={`${source.label}\nClick: primary A · Right click: secondary B\n${p.label('source' + i)} / ${p.label('secondary' + i)}`}
          ><span class="key mono">{i + 1}</span><span class="name">{source.label}</span
          >{#if !w.matrix?.scenes[w.sceneIndex].frames[i]}<CircleAlert size={11} />{/if}</button
        >{/each}
      <button
        class="add"
        aria-label="Add sources"
        disabled={w.demo}
        data-tip={p.hint('append')}
        onclick={() => open(w.matrix?.sources[0].kind === 'folder', true)}
        ><Plus size={14} /></button
      >
    </div>{:else}<div class="collection-hint">
      <span>Every source is available in Browse all.</span><span
        >{w.frames.filter(Boolean).length} ready · others load on selection</span
      >
    </div>{/if}
</div>

<style>
  .source-island {
    position: absolute;
    top: 52px;
    left: 50%;
    transform: translateX(-50%);
    width: min(730px, calc(100vw - 180px));
    padding: 13px 15px 12px;
    border-radius: 15px;
    background: linear-gradient(130deg, #162123e8, #11151bef);
  }
  .caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    font-size: 9px;
    letter-spacing: 0.13em;
    color: #7c9e94;
  }
  .caption b {
    color: #97aaa7;
    font-weight: 400;
    letter-spacing: 0;
    margin-left: 10px;
  }
  .caption i {
    padding: 0 4px;
    font-style: normal;
    color: #506a60;
  }
  .tools {
    display: flex;
    gap: 7px;
  }
  .tools button {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #adc4bb;
    font-size: 10px;
    letter-spacing: 0;
    border: 1px solid #b9daca15;
    background: #b9daca06;
    border-radius: 5px;
    padding: 5px 7px;
  }
  kbd {
    font:
      8px Consolas,
      monospace;
    color: #698e7e;
    margin-left: 5px;
  }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr);
    gap: 6px;
    align-items: center;
  }
  .selection {
    padding: 10px 12px;
    border-radius: 9px;
    background: linear-gradient(120deg, #88dfcd09, #ffffff02);
    border: 1px solid #9ee9d322;
    min-width: 0;
  }
  .selection.secondary {
    border-color: #d9b67324;
    background: linear-gradient(120deg, #d9b67308, #ffffff02);
  }
  .selection-heading {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #77978a;
    font-size: 8px;
    letter-spacing: 0.1em;
  }
  .badge {
    background: #7cddc920;
    color: #a7efdf;
    padding: 2px 4px;
    border-radius: 3px;
    font:
      9px Consolas,
      monospace;
  }
  .secondary .badge {
    background: #d9b67320;
    color: #eacf9c;
  }
  .arrows {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    font:
      9px Consolas,
      monospace;
    color: #749285;
  }
  .arrows button {
    display: grid;
    place-items: center;
    background: none;
    color: #91ab9f;
    padding: 2px;
  }
  .source-name {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    text-align: left;
    background: none;
    padding: 7px 0 4px;
    color: #dcece5;
  }
  .source-name strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
  }
  .source-name :global(svg) {
    color: #799888;
    flex-shrink: 0;
  }
  .metadata {
    font-size: 9px;
    color: #819b90;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .score-line {
    min-height: 16px;
    margin-top: 6px;
    color: #637e72;
    font-size: 9px;
  }
  .score-line b {
    color: #b7cdae;
    font:
      10px Consolas,
      monospace;
    margin-left: 4px;
  }
  .reference {
    display: flex;
    gap: 4px;
    align-items: center;
    color: #7eb9a3;
  }
  .exchange {
    color: #78998a;
    background: none;
    padding: 6px;
    border-radius: 5px;
  }
  .sources {
    display: flex;
    gap: 5px;
    padding-top: 11px;
    overflow: auto;
  }
  .source {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 6px 8px;
    white-space: nowrap;
    border: 1px solid #ffffff08;
    border-radius: 5px;
    background: #ffffff03;
    color: #81988d;
    font-size: 10px;
    min-width: 0;
  }
  .source.active {
    border-color: #8ee0cc38;
    color: #c9e4d6;
    background: #8ee0cc0a;
  }
  .source.secondary {
    box-shadow: inset 0 -1px #c8a87168;
  }
  .source.missing {
    opacity: 0.5;
  }
  .name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .key {
    color: #77a38d;
    font-size: 9px;
  }
  .add {
    background: none;
    color: #94b8a4;
    padding: 5px;
  }
  button:hover {
    background-color: #a3daca12;
  }
  .collection-hint {
    display: flex;
    justify-content: space-between;
    padding-top: 10px;
    font-size: 9px;
    color: #728e80;
  }
  .import-menu {
    position: absolute;
    right: 15px;
    top: 44px;
    z-index: 40;
    width: 280px;
    border-radius: 10px;
    padding: 7px;
    background: #14221ffc;
  }
  .import-menu button {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    background: none;
    color: #c0d8cc;
    text-align: left;
    padding: 10px;
    border-radius: 6px;
    font-size: 12px;
  }
  .import-menu small {
    display: block;
    font-size: 10px;
    color: #7f9d8d;
    margin-top: 3px;
  }
  .import-menu button:hover {
    background: #ffffff08;
  }
  @media (max-width: 900px) {
    .source-island {
      width: calc(100vw - 120px);
    }
    .caption b,
    kbd,
    .collection-hint span:last-child {
      display: none;
    }
    .sources {
      overflow: auto;
    }
    .source {
      flex-shrink: 0;
    }
  }
</style>
