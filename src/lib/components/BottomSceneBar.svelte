<script lang="ts">
  import {
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Copy,
    Download,
    Maximize,
    SlidersHorizontal,
  } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  let query = $state('');
</script>

<div class="bottom-wrap" data-hud>
  {#if w.drawer}<div class="drawer glass">
      <div class="drawer-title">SCENES <span>{w.matrix?.scenes.length} frames</span></div>
      <input
        class="scene-search"
        aria-label="Search scenes"
        placeholder="Find a scene or frame number…"
        bind:value={query}
      />
      <div class="scene-list">
        {#each w.matrix?.scenes ?? [] as scene, i}{#if `${i + 1} ${scene.label}`
            .toLowerCase()
            .includes(query.toLowerCase())}<button
              class:current={w.sceneIndex === i}
              onclick={() => w.loadScene(i)}
              data-tip={`Load ${scene.label}. Available in ${scene.frames.filter(Boolean).length} of ${w.matrix?.sources.length} sources.`}
              ><span class="mono">{String(i + 1).padStart(2, '0')}</span><strong
                >{scene.label}</strong
              ><small
                >{scene.frames.filter(Boolean).length}/{w.matrix?.sources.length} sources</small
              ></button
            >{/if}{/each}
      </div>
    </div>{/if}
  <div class="bottom glass">
    <div class="stepper">
      <button
        onclick={() => w.scene(-1)}
        aria-label="Previous scene"
        data-tip={p.hint('previousScene')}
        disabled={(w.matrix?.scenes.length ?? 0) < 2}><ChevronLeft size={16} /></button
      ><button class="scene" onclick={() => (w.drawer = !w.drawer)} data-tip={p.hint('scenes')}
        ><span class="scene-caption">{w.matrix?.scenes[w.sceneIndex]?.label}</span><small
          class="mono">{w.sceneIndex + 1} / {w.matrix?.scenes.length}</small
        ><ChevronUp size={12} /></button
      ><button
        onclick={() => w.scene(1)}
        aria-label="Next scene"
        data-tip={p.hint('nextScene')}
        disabled={(w.matrix?.scenes.length ?? 0) < 2}><ChevronRight size={16} /></button
      >
    </div>
    <div class="separator"></div>
    <button class="fit" onclick={() => w.fit()} data-tip={p.hint('fit')}
      ><Maximize size={13} /><span>Fit</span></button
    >
    <div class="zooms">
      {#each [1, 2, 4, 8] as zoom}<button
          class:chosen={Math.abs(w.zoom - zoom) < 0.001}
          data-tip={`Set physical pixel zoom to ${zoom * 100}%.${zoom === 1 ? '\n' + p.label('actualSize') : ''}`}
          onclick={() => w.setZoom(zoom)}>{zoom * 100}%</button
        >{/each}
    </div>
    <span class="zoom-value mono">{Math.round(w.zoom * 100)}%</span>
    <button class="filter" onclick={() => w.setFilter()} data-tip={p.hint('filter')}
      ><SlidersHorizontal size={12} />{w.filter === 'auto'
        ? w.zoom >= 1
          ? 'NEAREST'
          : 'SMOOTH'
        : w.filter === 'nearest'
          ? 'NEAREST'
          : 'BILINEAR'}{w.filter === 'auto' ? ' · A' : ''}</button
    >
    <div class="separator"></div>
    <button class="export" onclick={() => w.copy()} data-tip={p.hint('copy')}
      ><Copy size={13} /><span>Copy PNG</span></button
    >
    <button class="export" onclick={() => w.exportHtml()} data-tip={p.hint('export')}
      ><Download size={13} /><span>Export HTML</span></button
    >
  </div>
</div>

<style>
  .bottom-wrap {
    position: absolute;
    bottom: 38px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100vw - 48px);
  }
  .bottom {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 11px;
    white-space: nowrap;
  }
  .scene-search {
    width: 100%;
    padding: 9px 11px;
    border: 1px solid #ffffff15;
    border-radius: 6px;
    background: #ffffff04;
    color: #c5d5cf;
    font-size: 11px;
    margin-bottom: 10px;
  }
  .bottom button {
    border-radius: 5px;
    background: none;
    color: #929da0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 10px;
    height: 29px;
    padding: 0 7px;
  }
  .bottom button:hover {
    background: #ffffff09;
    color: #e0eae7;
  }
  .stepper {
    display: flex;
    align-items: center;
  }
  .scene {
    min-width: 100px;
    max-width: 220px;
    gap: 8px !important;
  }
  .scene-caption {
    overflow: hidden;
    text-overflow: ellipsis;
    color: #c0cbc9;
  }
  .scene small {
    font-size: 9px;
    color: #647773;
  }
  .separator {
    height: 21px;
    width: 1px;
    background: #ffffff0c;
    margin: 0 5px;
  }
  .zooms {
    display: flex;
    gap: 1px;
  }
  .zooms button {
    font-size: 9px;
    color: #6c7979 !important;
    padding: 0 5px;
  }
  .zooms button.chosen {
    background: #9bd9c312;
    color: #bde5d5 !important;
  }
  .zoom-value {
    min-width: 34px;
    font-size: 10px;
    color: #9dabaa;
    text-align: center;
  }
  .filter {
    font:
      8px Consolas,
      monospace !important;
    color: #86a29a !important;
  }
  .export {
    font-size: 9px !important;
  }
  .drawer {
    padding: 14px;
    border-radius: 12px;
    margin: 0 auto 10px;
    max-width: 670px;
  }
  .drawer-title {
    color: #9cacaa;
    font-size: 9px;
    letter-spacing: 0.13em;
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .drawer-title span {
    color: #5a6a67;
    letter-spacing: 0;
  }
  .scene-list {
    max-height: 220px;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
  }
  .scene-list button {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    background: #ffffff04;
    padding: 10px;
    text-align: left;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 10px;
    color: #81948c;
  }
  .scene-list button.current {
    border-color: #8ee0c333;
    background: #8ee0c30a;
  }
  .scene-list strong {
    color: #b8c7c0;
    font-weight: 400;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scene-list small {
    width: 100%;
    color: #56695f;
    font-size: 9px;
    padding-left: 21px;
  }
  @media (max-width: 1150px) {
    .zooms button:nth-child(n + 3) {
      display: none;
    }
    .export span {
      display: none;
    }
    .scene {
      max-width: 160px;
    }
  }
</style>
