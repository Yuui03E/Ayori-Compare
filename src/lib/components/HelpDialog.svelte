<script lang="ts">
  import { X, Keyboard, Search, RotateCcw, Settings2, MousePointer2 } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  import { actions, chord } from '../shortcuts';
  let dialog: HTMLDialogElement;
  let query = $state('');
  let editing = $state<string | null>(null);
  let feedback = $state('');
  let tab = $state<'shortcuts' | 'interface'>('shortcuts');
  const groups = [...new Set(actions.map((a) => a.group))];
  const filtered = $derived(
    actions.filter((a) =>
      `${a.label} ${a.description} ${p.label(a.id)}`.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  $effect(() => {
    if (dialog) {
      if (w.help && !dialog.open) {
        editing = null;
        feedback = '';
        dialog.showModal();
      }
      if (!w.help && dialog.open) dialog.close();
    }
  });
  function capture(e: KeyboardEvent) {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      editing = null;
      feedback = '';
      return;
    }
    const key = chord(e);
    if (!key || e.repeat) return;
    const error = p.assign(editing, key);
    feedback = error ?? 'Shortcut saved.';
    if (!error) editing = null;
  }
</script>

<svelte:window onkeydown={capture} />
<dialog
  bind:this={dialog}
  aria-labelledby="settings-heading"
  onclose={() => {
    w.help = false;
    editing = null;
  }}
  oncancel={(e) => {
    if (editing) {
      e.preventDefault();
      editing = null;
    }
  }}
  class="settings glass"
>
  <div class="heading">
    <div>
      <span class="eyebrow">MAKE IT YOURS</span>
      <h2 id="settings-heading">Settings & shortcuts</h2>
      <p>Your tools, one keystroke away. Changes save automatically on this device.</p>
    </div>
    <button
      class="icon-button"
      aria-label="Close settings"
      data-tip="Close settings and return to the comparison. Escape also closes this window."
      onclick={() => (w.help = false)}><X size={19} /></button
    >
  </div>
  <div class="tabs" role="tablist" aria-label="Settings pages">
    <button
      role="tab"
      aria-selected={tab === 'shortcuts'}
      class:chosen={tab === 'shortcuts'}
      onclick={() => {
        tab = 'shortcuts';
        editing = null;
      }}><Keyboard size={16} /> Keyboard shortcuts <span>{actions.length}</span></button
    >
    <button
      role="tab"
      aria-selected={tab === 'interface'}
      class:chosen={tab === 'interface'}
      onclick={() => {
        tab = 'interface';
        editing = null;
      }}><Settings2 size={16} /> Interface & guidance</button
    >
  </div>
  {#if tab === 'shortcuts'}
    <div class="search-row">
      <label class="search"
        ><Search size={16} /><input
          aria-label="Search shortcuts"
          placeholder="Search actions or keys…"
          bind:value={query}
        /></label
      ><button
        class="text-button"
        data-tip="Restore every shortcut to its original assignment."
        onclick={() => {
          p.reset();
          editing = null;
          feedback = 'All shortcuts restored.';
        }}><RotateCcw size={14} /> Reset all</button
      >
    </div>
    <div class="notice" role="status">
      {p.error ||
        feedback ||
        (editing
          ? 'Press your new shortcut. Escape cancels. Conflicts are kept unchanged.'
          : 'Click a key to change it. Clear removes an assignment. Tab always moves keyboard focus.')}
    </div>
    <div class="shortcut-list">
      {#each groups as group}
        {@const entries = filtered.filter((a) => a.group === group)}
        {#if entries.length}<h3>{group}</h3>{/if}
        {#each entries as action}
          <div class="shortcut-row" class:recording={editing === action.id}>
            <div><strong>{action.label}</strong><small>{action.description}</small></div>
            <button
              class="binding"
              class:recording={editing === action.id}
              aria-label={`Edit ${action.label} shortcut`}
              data-tip="Press a key or combination to replace this assignment. Your new key appears in hover help immediately."
              onclick={() => {
                editing = action.id;
                feedback = '';
              }}
              >{editing === action.id ? 'Press keys…' : p.label(action.id) || 'Unassigned'}</button
            >
            <button
              class="clear"
              aria-label={`Clear ${action.label} shortcut`}
              data-tip="Remove this keyboard assignment. The on-screen control remains available."
              onclick={() => {
                p.clear(action.id);
                editing = null;
                feedback = 'Shortcut cleared.';
              }}>Clear</button
            >
            <button
              class="icon-button"
              aria-label={`Reset ${action.label} shortcut`}
              data-tip="Restore this action’s default shortcut."
              onclick={() => {
                feedback = p.reset(action.id) ?? 'Default shortcut restored.';
                editing = null;
              }}><RotateCcw size={13} /></button
            >
          </div>
        {/each}
      {/each}
      {#if !filtered.length}<p class="empty-result">
          No matching actions. Try “source”, “zoom” or “open”.
        </p>{/if}
    </div>
  {:else}
    <div class="interface-panel">
      <label class="preference"
        ><div>
          <strong>Auto-hide comparison controls</strong>
          <p>
            Fade the floating controls after 2.5 seconds of inactivity. Move the pointer to bring
            them back.
          </p>
        </div>
        <input
          type="checkbox"
          checked={p.autoHide}
          data-tip="Automatically fade controls while you inspect the image. The H shortcut can still lock them hidden."
          onchange={(e) => {
            p.autoHide = e.currentTarget.checked;
            p.save();
          }}
        /></label
      >
      <label class="preference"
        ><div>
          <strong>Show helpful tooltips</strong>
          <p>Hover or focus controls to see what they do and their current shortcuts.</p>
        </div>
        <input
          type="checkbox"
          checked={p.tooltips}
          data-tip="Show descriptions and current shortcuts when controls are hovered or focused."
          onchange={(e) => {
            p.tooltips = e.currentTarget.checked;
            p.save();
          }}
        /></label
      >
      <div class="guide">
        <MousePointer2 size={20} />
        <div>
          <h3>Mouse gestures</h3>
          <p>
            Wheel to zoom around the cursor. Left or middle drag to pan; in curtain mode use Ctrl +
            left drag or middle drag. Hold the right button for the dual loupe. Right-click a source
            to select B.
          </p>
        </div>
      </div>
      <div class="guide">
        <Keyboard size={20} />
        <div>
          <h3>A few images or a whole release</h3>
          <p>
            Open images for alternatives of one frame. Open one folder per release or encoding group
            to match many scenes automatically. Use Add sources to extend a comparison, and Browse
            sources to search a large collection.
          </p>
          <p>
            Large collections load selected images and nearby sources as you browse. A newly
            selected image may take a moment to prepare; loaded images switch immediately.
            Four-quadrant mode shows sources 1–4.
          </p>
        </div>
      </div>
      <p class="precision-note">
        Source RGB · SDR interpretation. Exact decoded samples are retained for readout.
        Reduced-precision previews are labeled; scores use RGB8 sRGB. ICC and HDR conversion are
        outside this comparison workflow.
      </p>
    </div>
  {/if}
  <div class="settings-footer">
    <span>AYORI / COMPARE</span><span>Esc to return to your images</span>
  </div>
</dialog>

<style>
  .settings {
    width: min(880px, calc(100vw - 48px));
    max-height: calc(100vh - 64px);
    padding: 0;
    border-radius: 18px;
    color: #dbe4e5;
    overflow: auto;
  }
  dialog::backdrop {
    background: #030609b8;
    backdrop-filter: blur(8px);
  }
  .heading {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding: 27px 28px 20px;
    background: radial-gradient(ellipse at top left, #70cab91a, transparent 70%);
  }
  .eyebrow {
    color: #83bdb2;
    font-size: 10px;
    letter-spacing: 0.17em;
  }
  h2 {
    font-size: 27px;
    font-weight: 500;
    letter-spacing: -0.035em;
    margin: 8px 0;
  }
  .heading p {
    color: #94a0a6;
    font-size: 12px;
    margin: 0;
    line-height: 1.5;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .icon-button {
    background: transparent;
    color: #8b9d9e;
    padding: 8px;
    border-radius: 6px;
    align-self: start;
  }
  button:hover {
    background: #a9d8cc12;
    color: #d2ebe4;
  }
  .tabs {
    display: flex;
    gap: 12px;
    padding: 0 28px;
    border-bottom: 1px solid #ffffff10;
  }
  .tabs button {
    background: none;
    color: #8f9aa3;
    padding: 13px 4px;
    font-size: 12px;
    border-bottom: 2px solid transparent;
  }
  .tabs button.chosen {
    color: #b5e8da;
    border-bottom-color: #8bd1c4;
  }
  .tabs span {
    font:
      10px Consolas,
      monospace;
    border-radius: 4px;
    padding: 2px 5px;
    background: #b9e8d910;
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px 28px 10px;
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
  .text-button,
  .clear {
    color: #9caaa8;
    background: transparent;
    font-size: 11px;
    padding: 7px;
    border-radius: 5px;
  }
  .notice {
    min-height: 32px;
    padding: 0 28px 10px;
    font-size: 11px;
    color: #b0b9a9;
  }
  .shortcut-list {
    max-height: 48vh;
    overflow: auto;
    padding: 0 28px 18px;
  }
  h3 {
    font-size: 10px;
    font-weight: 500;
    color: #82b5a9;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    margin: 20px 0 10px;
  }
  .shortcut-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 185px 42px 30px;
    gap: 10px;
    align-items: center;
    border-bottom: 1px solid #ffffff08;
    padding: 11px 0;
  }
  .shortcut-row strong {
    font-size: 12px;
    font-weight: 500;
  }
  .shortcut-row small {
    display: block;
    color: #82908f;
    font-size: 10px;
    line-height: 1.55;
    margin-top: 3px;
  }
  .binding {
    border: 1px solid #ffffff16;
    border-radius: 6px;
    padding: 8px;
    background: #ffffff05;
    font:
      11px Consolas,
      monospace;
    color: #bfcec9;
    min-height: 33px;
  }
  .binding.recording {
    border-color: #8fd9c6;
    color: #b8f2dc;
    background: #9de6ce14;
  }
  .interface-panel {
    padding: 8px 28px 24px;
  }
  .preference {
    display: flex;
    gap: 40px;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0;
    border-bottom: 1px solid #ffffff0b;
  }
  .preference strong {
    font-weight: 500;
    font-size: 13px;
  }
  .preference p,
  .guide p {
    font-size: 12px;
    color: #94a5a3;
    line-height: 1.7;
    margin: 5px 0 0;
  }
  .preference input {
    width: 18px;
    height: 18px;
    accent-color: #9dddd0;
    flex-shrink: 0;
  }
  .guide {
    display: flex;
    align-items: start;
    gap: 16px;
    margin-top: 24px;
    padding: 18px;
    background: #8ed5c406;
    border: 1px solid #8ed5c414;
    border-radius: 10px;
    color: #8cbaaf;
  }
  .guide :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .guide h3 {
    margin: 0 0 8px;
  }
  .precision-note {
    color: #788c87;
    font-size: 10px;
    line-height: 1.7;
    margin: 20px 0 0;
  }
  .settings-footer {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #ffffff0b;
    padding: 14px 28px;
    font:
      9px Consolas,
      monospace;
    color: #71867e;
  }
  .empty-result {
    color: #82958c;
    padding: 30px 0;
    font-size: 13px;
  }
  @media (max-width: 700px) {
    .shortcut-row {
      grid-template-columns: 1fr 135px 40px;
    }
    .shortcut-row .icon-button {
      display: none;
    }
    .shortcut-row small {
      display: none;
    }
  }
</style>
