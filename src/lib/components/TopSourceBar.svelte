<script lang="ts">
  import { Plus, FolderOpen, CircleAlert } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  const size = (bytes: number) => (bytes ? (bytes / 1e6).toFixed(1) + ' MB' : 'Generated sample');
</script>

<div class="source-island glass" data-hud>
  <div class="caption">
    <span>{w.demo ? 'SAMPLE COMPARISON' : 'SOURCE COMPARISON'}</span>
    <div class="legend"><i class="a"></i> PRIMARY <i class="b"></i> SECONDARY</div>
    <button
      title="Start a new comparison"
      aria-label="Open a new comparison"
      onclick={() => w.choose()}><FolderOpen size={14} /></button
    >
  </div>
  <div class="sources">
    {#each w.matrix?.sources ?? [] as source, i}
      <button
        class="source"
        class:active={w.slotA === i}
        class:secondary={w.slotB === i}
        class:missing={!w.frames[i] && !w.loading}
        onclick={() => w.select(i)}
        oncontextmenu={(e) => {
          e.preventDefault();
          w.select(i, true);
        }}
        title={`${source.label}\n${source.origin}\nClick: primary A · Right click: secondary B${w.errors[i] ? '\n' + w.errors[i] : ''}`}
      >
        <span class="key mono">{i + 1}</span><span class="name">{source.label}</span>
        {#if w.slotA === i}<span class="badge a">A</span>{/if}{#if w.slotB === i}<span
            class="badge b">B</span
          >{/if}
        {#if !w.frames[i] && !w.loading}<CircleAlert size={12} />{/if}
      </button>
    {/each}
    <button
      class="add"
      title="Append source folders (Alt-drop)"
      aria-label="Append source folders"
      disabled={w.demo || (w.matrix?.sources.length ?? 0) >= 8}
      onclick={() => w.choose(w.matrix?.sources[0].kind === 'folder', true)}
      ><Plus size={16} /></button
    >
  </div>
  <div class="metadata mono">
    {#if w.frames[w.slotA]}
      {@const frame = w.frames[w.slotA]!}
      <span>{frame.width} × {frame.height}</span><b>·</b><span
        >{frame.originalDepth}-bit {w.demo
          ? 'RGB'
          : w.matrix?.scenes[w.sceneIndex].frames[w.slotA]?.split('.').at(-1)?.toUpperCase()}</span
      ><b>·</b><span>{size(frame.fileSize)}</span>
      {#if w.slotA === 0}<span class="reference">REFERENCE</span
        >{:else if w.scores[w.slotA]?.score !== null && w.scores[w.slotA]?.score !== undefined}<span
          class="score"
          title="SSIMULACRA2 against source 1, using RGB8 sRGB; * means the reference was resized with Catmull-Rom."
          >SSIM2 {w.scores[w.slotA].score?.toFixed(2)}{w.scores[w.slotA].resampled
            ? ' *'
            : ''}</span
        >{/if}
    {:else}<span>{w.loading ? 'Loading source…' : 'Source missing in this scene'}</span>{/if}
  </div>
</div>

<style>
  .source-island {
    position: absolute;
    top: 54px;
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100vw - 180px);
    padding: 12px 14px 10px;
    border-radius: 13px;
    min-width: 390px;
  }
  .caption {
    display: flex;
    align-items: center;
    gap: 18px;
    font-size: 8px;
    letter-spacing: 0.15em;
    color: #676e74;
    margin: 0 2px 10px;
  }
  .caption > span {
    flex: 1;
  }
  .caption button {
    background: none;
    color: #7e8a86;
    padding: 0;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .legend i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }
  .legend .a {
    background: #80ddd3;
  }
  .legend .b {
    background: #dfbc79;
    margin-left: 8px;
  }
  .sources {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px;
  }
  .source {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    border-radius: 7px;
    background: #ffffff05;
    border: 1px solid #ffffff06;
    padding: 8px 10px;
    font-size: 11px;
    color: #959aa5;
  }
  .source:hover {
    background: #ffffff0d;
  }
  .source.active {
    background: #6bd2bc0d;
    border-color: #6bd2bc40;
    color: #dceae5;
  }
  .source.secondary:not(.active) {
    border-color: #d4b47732;
  }
  .source.missing {
    opacity: 0.55;
  }
  .name {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .key {
    font-size: 9px;
    color: #818990;
    background: #ffffff08;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .badge {
    font:
      9px Consolas,
      monospace;
    padding: 2px 4px;
    border-radius: 3px;
  }
  .badge.a {
    color: #8cded1;
    background: #6bd2bc18;
  }
  .badge.b {
    color: #e3c48a;
    background: #e3c48a14;
  }
  .add {
    background: transparent;
    color: #6c7976;
    padding: 4px;
  }
  .metadata {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 9px;
    color: #727e82;
    margin-top: 10px;
    min-height: 13px;
  }
  .metadata b {
    font-weight: 400;
    color: #35423e;
  }
  .reference {
    color: #6f998d;
    font-size: 8px;
    letter-spacing: 0.08em;
    margin-left: 8px;
  }
  .score {
    color: #a1bba5;
    margin-left: 8px;
  }
</style>
