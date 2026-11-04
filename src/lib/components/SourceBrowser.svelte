<script lang="ts">
  import {
    X,
    Search,
    Images,
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight,
    Check,
    CircleAlert,
  } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  let query = $state('');
  let page = $state(0);
  let availableOnly = $state(false);
  const matches = $derived(
    (w.matrix?.sources ?? [])
      .map((source, slot) => ({ source, slot }))
      .filter(
        ({ source, slot }) =>
          `${slot + 1} ${source.label} ${source.origin}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!availableOnly || w.matrix?.scenes[w.sceneIndex].frames[slot]),
      ),
  );
  const pageCount = $derived(Math.max(1, Math.ceil(matches.length / 100)));
  $effect(() => {
    if (page >= pageCount) page = pageCount - 1;
  });
  $effect(() => {
    if (dialog) {
      if (w.sourceBrowser && !dialog.open) {
        query = '';
        page = 0;
        dialog.showModal();
        input?.focus();
      }
      if (!w.sourceBrowser && dialog.open) dialog.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  class="browser glass"
  aria-labelledby="browser-title"
  onclose={() => (w.sourceBrowser = false)}
>
  <div class="heading">
    <div>
      <span class="eyebrow">YOUR COMPARISON LIBRARY</span>
      <h2 id="browser-title">Browse sources <span>{w.matrix?.sources.length}</span></h2>
      <p>Choose any two images. Your zoom, pan and inspection mode stay with you.</p>
    </div>
    <button
      class="icon"
      aria-label="Close source browser"
      data-tip="Return to the comparison. Escape also closes this browser."
      onclick={() => (w.sourceBrowser = false)}><X size={20} /></button
    >
  </div>
  <div class="selection">
    <div><span class="badge a">A</span><strong>{w.matrix?.sources[w.slotA]?.label}</strong></div>
    <button
      class="icon"
      aria-label="Exchange A and B"
      data-tip={p.hint('exchange')}
      onclick={() => w.exchangeSources()}><ArrowLeftRight size={16} /></button
    >
    <div><span class="badge b">B</span><strong>{w.matrix?.sources[w.slotB]?.label}</strong></div>
  </div>
  <div class="search-row">
    <label class="search"
      ><Search size={17} /><input
        bind:this={input}
        aria-label="Search sources"
        placeholder="Search by name, path or source number…"
        bind:value={query}
        oninput={() => (page = 0)}
      /></label
    ><label class="available"
      ><input type="checkbox" bind:checked={availableOnly} /> In this scene</label
    >
  </div>
  <div class="table-head">
    <span>SOURCE / IMAGE</span><span>DETAILS</span><span>COMPARE AS</span>
  </div>
  <div class="source-list">
    {#each matches.slice(page * 100, (page + 1) * 100) as { source, slot } (slot)}
      {@const exists = !!w.matrix?.scenes[w.sceneIndex].frames[slot]}
      {@const frame = w.frames[slot]}
      {@const dims = w.dimensions[slot]}
      <div
        class="row"
        class:selected={w.slotA === slot || w.slotB === slot}
        class:missing={!exists}
      >
        <div
          class="identity"
          data-tip={`${source.origin}${w.errors[slot] ? '\n' + w.errors[slot] : ''}`}
        >
          <span class="number">{String(slot + 1).padStart(2, '0')}</span><Images size={17} />
          <div>
            <strong>{source.label}</strong><small
              >{slot === 0
                ? 'Reference source'
                : source.kind === 'folder'
                  ? 'Source folder'
                  : 'Image alternative'}{w.errors[slot]
                ? ' · Decode failed'
                : !exists
                  ? ' · Missing in this scene'
                  : ''}</small
            >
          </div>
        </div>
        <div class="details">
          {#if w.errors[slot]}<CircleAlert size={13} /><span>Unable to decode</span
            >{:else if !exists}<span>Missing frame</span>{:else if frame}<span
              >{frame.width} × {frame.height} · {frame.originalDepth}-bit</span
            >{:else if dims}<span>{dims[0]} × {dims[1]}</span>{:else}<span
              >Details on selection</span
            >{/if}<small
            >{w.pendingSlots.includes(slot)
              ? 'Preparing…'
              : frame
                ? 'Ready to compare'
                : exists
                  ? 'Loads when selected'
                  : 'Shown as an empty comparison cell'}{w.scores[slot]?.score != null
              ? ` · SSIM2 ${w.scores[slot].score!.toFixed(2)}${w.scores[slot].resampled ? ' *' : ''}`
              : ''}</small
          >
        </div>
        <div class="assign">
          <button
            class:a={w.slotA === slot}
            aria-pressed={w.slotA === slot}
            aria-label={`Set source ${slot + 1} as A`}
            data-tip={`Use ${source.label} as the primary image A.${slot < 8 && p.label('source' + slot) ? '\n' + p.label('source' + slot) : ''}`}
            onclick={() => w.select(slot)}
            >A {#if w.slotA === slot}<Check size={12} />{/if}</button
          ><button
            class:b={w.slotB === slot}
            aria-pressed={w.slotB === slot}
            aria-label={`Set source ${slot + 1} as B`}
            data-tip={`Use ${source.label} as the secondary image B.${slot < 8 && p.label('secondary' + slot) ? '\n' + p.label('secondary' + slot) : ''}`}
            onclick={() => w.select(slot, true)}
            >B {#if w.slotB === slot}<Check size={12} />{/if}</button
          >
        </div>
      </div>
    {/each}
    {#if !matches.length}<p class="empty">No sources match this search.</p>{/if}
  </div>
  <footer>
    <span
      >{matches.length} sources · Scene {w.sceneIndex + 1} of {w.matrix?.scenes.length}<small
        >Only the current comparison and nearby images stay ready in memory.</small
      ></span
    >
    <div>
      {#if pageCount > 1}<button
          class="icon"
          aria-label="Previous source page"
          disabled={page === 0}
          onclick={() => page--}><ChevronLeft size={16} /></button
        ><span>{page + 1}/{pageCount}</span><button
          class="icon"
          aria-label="Next source page"
          disabled={page + 1 === pageCount}
          onclick={() => page++}><ChevronRight size={16} /></button
        >{/if}<button class="done" onclick={() => (w.sourceBrowser = false)}>View comparison</button
      >
    </div>
  </footer>
</dialog>

<style>
  .browser {
    width: min(900px, calc(100vw - 48px));
    max-height: calc(100vh - 64px);
    padding: 0;
    border-radius: 18px;
    color: #dae6e1;
    overflow: auto;
  }
  dialog::backdrop {
    background: #030609b8;
    backdrop-filter: blur(8px);
  }
  .heading {
    display: flex;
    justify-content: space-between;
    padding: 26px 28px 20px;
    background: #000;
  }
  .eyebrow {
    color: #83bdb2;
    font-size: 10px;
    letter-spacing: 0.17em;
  }
  h2 {
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.035em;
    margin: 7px 0;
  }
  h2 span {
    font:
      13px Consolas,
      monospace;
    color: #97c5b9;
    background: #8ac7b812;
    padding: 4px 8px;
    border: 1px solid #8ac7b824;
    border-radius: 6px;
    vertical-align: middle;
    margin-left: 7px;
  }
  p {
    color: #8d9e9e;
    font-size: 12px;
    margin: 0;
    line-height: 1.6;
  }
  .icon {
    background: none;
    color: #9aaea7;
    padding: 7px;
    border-radius: 6px;
    align-self: start;
    display: inline-flex;
    align-items: center;
  }
  button:hover {
    background: #9de0ca16;
  }
  .selection {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 14px 28px;
    border-block: 1px solid #ffffff0c;
    background: #ffffff02;
  }
  .selection > div {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }
  .selection strong {
    font-size: 12px;
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    border-radius: 5px;
    padding: 4px 7px;
    font:
      11px Consolas,
      monospace;
  }
  .a {
    color: #9ce8dc !important;
    border-color: #8adac63d !important;
    background: #80d2c214 !important;
  }
  .b {
    color: #edd09c !important;
    border-color: #dfbc793d !important;
    background: #dfbc7914 !important;
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px 28px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #ffffff05;
    border: 1px solid #ffffff13;
    padding: 10px 12px;
    border-radius: 8px;
    flex: 1;
    color: #748d87;
  }
  .search input {
    width: 100%;
    background: transparent;
    color: #d2ddd9;
    border: none;
    font-size: 12px;
  }
  .search input:focus {
    outline: none;
  }
  .search:focus-within {
    border-color: #85cdbc;
  }
  .available {
    font-size: 11px;
    color: #a7b8ae;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  input[type='checkbox'] {
    accent-color: #99d4bf;
  }
  .table-head,
  .row {
    display: grid;
    grid-template-columns: minmax(180px, 1.3fr) minmax(170px, 1fr) 105px;
    align-items: center;
    gap: 15px;
  }
  .table-head {
    font-size: 9px;
    letter-spacing: 0.11em;
    color: #6c8980;
    padding: 0 28px 10px;
    border-bottom: 1px solid #ffffff0a;
  }
  .source-list {
    max-height: 43vh;
    overflow: auto;
    padding: 0 18px;
  }
  .row {
    padding: 12px 10px;
    border-bottom: 1px solid #ffffff07;
    min-height: 64px;
  }
  .row.selected {
    background: #92d6c007;
  }
  .row.missing {
    opacity: 0.55;
  }
  .identity {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
  }
  .identity > div {
    min-width: 0;
  }
  .number {
    font:
      10px Consolas,
      monospace;
    color: #6c8f81;
    min-width: 21px;
  }
  .identity :global(svg) {
    flex-shrink: 0;
    color: #688d7e;
  }
  strong {
    font-size: 12px;
    font-weight: 500;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    display: block;
    color: #798e87;
    font-size: 10px;
    margin-top: 5px;
  }
  .details {
    color: #aabcb1;
    font:
      10px Consolas,
      monospace;
  }
  .details small {
    font-family: 'Segoe UI', sans-serif;
  }
  .assign {
    display: flex;
    gap: 6px;
  }
  .assign button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 46px;
    min-height: 31px;
    border: 1px solid #ffffff14;
    border-radius: 6px;
    background: #ffffff04;
    font:
      11px Consolas,
      monospace;
    color: #91a29b;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 28px;
    border-top: 1px solid #ffffff10;
    color: #9bb8ab;
    font-size: 11px;
    gap: 16px;
  }
  footer > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .done {
    background: #b2dfcd;
    color: #183c30;
    padding: 10px 16px;
    font-size: 12px;
    border-radius: 7px;
    white-space: nowrap;
  }
  .done:hover {
    background: #d1eee0;
  }
  .empty {
    text-align: center;
    padding: 48px 20px;
  }
  @media (max-width: 700px) {
    .table-head,
    .row {
      grid-template-columns: minmax(150px, 1fr) 105px;
    }
    .details,
    .table-head span:nth-child(2) {
      display: none;
    }
    .available {
      display: none;
    }
  }
</style>
