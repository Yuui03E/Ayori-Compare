<script lang="ts">
  import { X, Keyboard, Search, RotateCcw, Settings2, BookOpen } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
  import { actions, chord } from '../shortcuts';
  let dialog: HTMLDialogElement;
  let query = $state(''),
    editing = $state<string | null>(null),
    feedback = $state('');
  let tab = $state<'shortcuts' | 'guide' | 'interface'>('shortcuts');
  let advanced = $state(false),
    guide = $state<'app' | 'compare'>('app');
  const essentialIds = [
    'flicker',
    'toggleZoom',
    'loupe',
    'mode1',
    'mode2',
    'previousSource',
    'nextSource',
    'previousScene',
    'nextScene',
    'openImages',
    'sources',
    'settings',
  ];
  const appActions = actions.filter((a) => a.group === 'Application');
  const essentialActions = essentialIds.map((id) => actions.find((a) => a.id === id)!);
  const filtered = $derived(
    query.trim()
      ? actions.filter((a) =>
          `${a.label} ${a.description} ${p.label(a.id)}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
      : advanced
        ? [...essentialActions, ...actions.filter((a) => !essentialIds.includes(a.id))]
        : essentialActions,
  );
  $effect(() => {
    if (dialog) {
      if (w.help && !dialog.open) {
        editing = null;
        feedback = '';
        query = '';
        advanced = false;
        tab = 'shortcuts';
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
  function changeTab(next: typeof tab) {
    tab = next;
    editing = null;
    feedback = '';
  }
</script>

<svelte:window onkeydown={capture} />
<dialog
  bind:this={dialog}
  aria-labelledby="settings-heading"
  class="settings glass"
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
>
  <div class="heading">
    <div>
      <h2 id="settings-heading">Help & shortcuts</h2>
      <p>A few useful keys. Everything else is a click away.</p>
    </div>
    <button
      class="icon-button"
      aria-label="Close settings"
      data-tip="Return to your images · Esc"
      onclick={() => (w.help = false)}><X size={18} /></button
    >
  </div>
  <nav class="tabs" aria-label="Help pages">
    <button
      aria-current={tab === 'shortcuts' ? 'page' : undefined}
      class:chosen={tab === 'shortcuts'}
      onclick={() => changeTab('shortcuts')}><Keyboard size={14} /> Keyboard shortcuts</button
    >
    <button
      aria-current={tab === 'guide' ? 'page' : undefined}
      class:chosen={tab === 'guide'}
      onclick={() => changeTab('guide')}><BookOpen size={14} /> Using & comparing</button
    >
    <button
      aria-current={tab === 'interface' ? 'page' : undefined}
      class:chosen={tab === 'interface'}
      onclick={() => changeTab('interface')}><Settings2 size={14} /> Interface</button
    >
  </nav>
  {#if tab === 'shortcuts'}
    <div class="app-keys">
      <span>App</span>{#each appActions as action}<button
          aria-label={`Find ${action.label} shortcut`}
          data-tip={`${p.hint(action.id)}\nClick to edit this shortcut.`}
          onclick={() => {
            query = action.label;
            editing = null;
          }}
          ><span
            >{action.id === 'quit'
              ? 'Quit'
              : action.id === 'maximize'
                ? 'Maximize'
                : action.label}</span
          ><kbd>{p.label(action.id) || 'Unassigned'}</kbd></button
        >{/each}
    </div>
    <div class="search-row">
      <label class="search"
        ><Search size={14} /><input
          aria-label="Search shortcuts"
          placeholder="Find any action or key…"
          bind:value={query}
        /></label
      >
      <button
        class="text-button"
        data-tip="Restore every shortcut to its original assignment."
        onclick={() => {
          p.reset();
          editing = null;
          feedback = 'All shortcuts restored.';
        }}><RotateCcw size={12} /> Reset all</button
      >
    </div>
    <div class="list-heading">
      <strong
        >{query.trim()
          ? 'Search all shortcuts'
          : advanced
            ? 'Essentials first · more actions below'
            : 'Start with these'}</strong
      >
      {#if !query.trim()}<button
          class="text-button"
          aria-expanded={advanced}
          onclick={() => {
            advanced = !advanced;
            editing = null;
          }}>{advanced ? 'Essentials only' : 'Show more shortcuts'}</button
        >{/if}
    </div>
    <div class="shortcut-list">
      {#each filtered as action, index}
        {#if advanced && !query.trim() && index === essentialIds.length}<h3>
            Optional shortcuts
          </h3>{/if}
        <div class="shortcut-row" class:recording={editing === action.id}>
          <div><strong>{action.label}</strong><small>{action.description}</small></div>
          <button
            class="binding"
            class:recording={editing === action.id}
            aria-label={`Edit ${action.label} shortcut`}
            data-tip="Click, then press a new key or combination. Changes save on this device."
            onclick={() => {
              editing = action.id;
              feedback = '';
            }}>{editing === action.id ? 'Press keys…' : p.label(action.id) || 'Unassigned'}</button
          >
          <button
            class="clear"
            aria-label={`Clear ${action.label} shortcut`}
            data-tip="Remove this keyboard assignment."
            onclick={() => {
              p.clear(action.id);
              editing = null;
              feedback = 'Shortcut cleared.';
            }}>Clear</button
          >
          <button
            class="icon-button"
            aria-label={`Reset ${action.label} shortcut`}
            data-tip="Restore this action’s default keys."
            onclick={() => {
              feedback = p.reset(action.id) ?? 'Default shortcut restored.';
              editing = null;
            }}><RotateCcw size={12} /></button
          >
        </div>
      {/each}
      {#if !filtered.length}<p class="empty-result">
          No matching actions. Try “source”, “zoom” or “open”.
        </p>{/if}
    </div>
    <div class="notice" role="status">
      {p.error ||
        feedback ||
        (editing
          ? 'Press your new shortcut. Escape cancels. Conflicting keys stay unchanged.'
          : 'Click a key to edit · saved automatically · Tab moves focus · Esc closes help')}
    </div>
  {:else if tab === 'guide'}
    <div class="guide-switch" aria-label="Guide topics">
      <button
        class:chosen={guide === 'app'}
        aria-pressed={guide === 'app'}
        onclick={() => (guide = 'app')}>Using Ayori</button
      >
      <button
        class:chosen={guide === 'compare'}
        aria-pressed={guide === 'compare'}
        onclick={() => (guide = 'compare')}>Comparing images</button
      >
    </div>
    <div class="guide-panel">
      {#if guide === 'app'}
        <section>
          <h3>1 · Bring in your sources</h3>
          <p>
            <b>One frame, several versions:</b> open or drop the images together. Images without a source/output
            naming pattern become alternatives of one scene.
          </p>
          <p>
            <b>Named source/output pairs:</b> open one folder or select the paired images.
            <b>src_01 / final_01</b>, <b>src_01 / filter_01</b> and <b>src(a) / out(b)</b>
            automatically place the source first for A and the output second for B. Matching scene names
            or numbers form rows; duplicate candidates are reported and left missing.
          </p>
          <p>
            <b>Several frames across releases:</b> choose one folder per WEB-DL, DVD, BDMV capture or
            encoding group. Matching filenames or frame numbers line up the scenes. Extract still images
            from video first.
          </p>
          <p>
            Collections can exceed 100 images. The + menu adds sources; selected images load as you
            browse. A missing frame stays visibly missing.
          </p>
        </section>
        <section>
          <h3>2 · Choose what to compare</h3>
          <p>
            Click the <b>A or B name</b> to search the collection and assign either side. The arrows between
            them exchange A/B. Hover a name for dimensions, bit depth, file size and score.
          </p>
          <p>
            Use <b>Scene</b> to find a matching frame across releases. Source stepping ({p.label(
              'previousSource',
            )} / {p.label('nextSource')}) changes A; scene stepping ({p.label('previousScene')} / {p.label(
              'nextScene',
            )}) changes the frame.
          </p>
        </section>
        <section>
          <h3>3 · Move around the image</h3>
          <p>
            <b>Scroll</b> to zoom at the pointer. <b>Drag</b> to pan. In curtain mode, use Ctrl +
            drag or middle drag. Hold the right mouse button or {p.label('loupe') ||
              'your loupe key'} for a dual loupe.
          </p>
          <p>
            Double right click to jump to your chosen zoom (currently {p.quickZoomPercent}%),
            centered on the clicked point. Double right click again to restore the previous zoom and
            pan, even after panning around. Change the target or disable the gesture in Interface. A
            right hold opens the loupe after a brief pause; a right drag opens it immediately.
          </p>
          <p>
            The percentage toggles fit / 100%. View options contains zoom presets, filtering and
            effect strength. Repeat a mode button to cycle its views; four quadrants shows sources
            1–4.
          </p>
        </section>
        <section>
          <h3>4 · Home, window & sharing</h3>
          <p>
            The Home button or {p.label('home')} opens the start page. Resume comparison returns to the
            same scene and view. Use {p.label('maximize')} to maximize/restore, {p.label(
              'minimize',
            )} to minimize and {p.label('quit') || 'the close button'} to quit. App shortcuts pause while
            editing text or using a dialog.
          </p>
          <p>
            <b>Copy PNG</b> captures the displayed comparison without the controls.
            <b>Export offline HTML</b>, in View options, includes every source and scene in a
            portable viewer. Large collections produce larger files.
          </p>
          <p>
            Local image edits reload automatically while keeping your view. If you hide the
            controls, press Escape to bring them back.
          </p>
        </section>
      {:else}
        <section>
          <h3>Start with a fair match</h3>
          <p>
            Compare the <b>same frame and crop</b>. Check alignment and dimensions before judging
            detail: a shifted frame or different resize can dominate the difference. Different
            resolutions share a normalized canvas; 100% follows the largest scene dimensions. Use
            equal-size frames to judge native-pixel detail. Different masters, DVD and WEB sources
            may have legitimate color, crop and grain differences.
          </p>
        </section>
        <section>
          <h3>Different resolutions & filtering</h3>
          <p>
            Each original image is displayed across the same area, using the largest scene width and
            height. For example, 1280 × 720 and 1920 × 1080 both fill a 1920 × 1080 comparison area
            at 100%. Different aspect ratios are stretched to that area too; match the crop and
            aspect ratio first.
          </p>
          <p>
            <b>Auto</b> uses nearest sampling at 100% and above, and smooth filtering below 100%.
            <b>Nearest</b>
            keeps hard pixel edges; <b>Bilinear</b> blends neighbors, with mipmaps for shrinking. This
            changes the preview only, not the original decoded pixels. The display does not use bicubic
            scaling. SSIMULACRA2 separately resizes source 1 to each candidate with Catmull–Rom.
          </p>
        </section>
        <section>
          <h3>Detail, texture & motion between sources</h3>
          <p>
            Start at <b>100%</b> with nearest filtering. Inspect hair, fine lines, subtitles and textured
            surfaces. Softened detail can suggest smoothing; bright or dark halos around edges can suggest
            ringing.
          </p>
          <p>
            Select two sources in turn, then use <b
              >{p.label('flicker') || 'your flicker shortcut'}</b
            > to alternate A with the previously viewed source. Curtain reveals changes along edges; Split
            shows A/B together. Judge grain across several scenes, since one still can be misleading.
          </p>
        </section>
        <section>
          <h3>Gradients, shadows & color</h3>
          <p>
            Look for steps in skies, fog and dark gradients. <b>Banding</b> cycles contour, shadow, luma
            and chroma views. These emphasize changes; always check the normal image again before calling
            an artifact visible.
          </p>
          <p>
            Block boundaries, color bleeding and lost shadow detail can be easier to spot with the
            loupe. Pixel readout preserves original decoded precision; its grid appears at 800%.
          </p>
        </section>
        <section>
          <h3>Use differences and scores as clues</h3>
          <p>
            <b>Difference</b> amplifies RGB error; repeat for a luma heatmap. Gain changes visibility,
            not the underlying error. Grain, alignment and color shifts can create strong differences
            without proving one release is worse.
          </p>
          <p>
            <b>SSIMULACRA2</b> compares against source 1 using RGB8 sRGB. Higher means closer under that
            metric, not a universal quality ranking. A resized-reference label means Catmull–Rom resizing
            was needed. Choose a trusted source 1 and inspect several scenes.
          </p>
        </section>
        <p class="precision-note">
          Source RGB is interpreted as SDR without ICC/HDR conversion. An 8-bit preview warning
          means GPU effects use reduced precision; original decoded values remain available in pixel
          readout.
        </p>
      {/if}
    </div>
  {:else}
    <div class="interface-panel">
      <div class="height-setting">
        <label for="bar-height"
          >Top bar height <output for="bar-height">{p.barHeight}px</output></label
        >
        <input
          id="bar-height"
          aria-label="Top bar height"
          type="range"
          min="16"
          max="44"
          step="1"
          value={p.barHeight}
          oninput={(e) => p.setBarHeight(+e.currentTarget.value)}
        />
        <div class="height-presets">
          {#each [16, 24, 32, 44] as height}<button
              class:chosen={p.barHeight === height}
              aria-pressed={p.barHeight === height}
              onclick={() => p.setBarHeight(height)}
              >{height}px{height === 16
                ? ' · Minimal'
                : height === 32
                  ? ' · Balanced'
                  : height === 44
                    ? ' · Roomy'
                    : ''}</button
            >{/each}
        </div>
        <p>
          Changes apply immediately and stay on this device. Hover help and menus remain readable at
          every size.
        </p>
      </div>
      <div class="zoom-setting">
        <label class="zoom-enabled"
          ><strong>Double-right-click zoom</strong><input
            type="checkbox"
            aria-label="Enable double-right-click zoom"
            checked={p.doubleRightZoom}
            onchange={(e) => {
              p.doubleRightZoom = e.currentTarget.checked;
              p.save();
            }}
          /></label
        >
        <label class="zoom-target" for="quick-zoom"
          >Target zoom <span
            ><input
              id="quick-zoom"
              aria-label="Double-right-click target zoom"
              type="number"
              min="1"
              max="12800"
              step="1"
              value={p.quickZoomPercent}
              onchange={(e) => p.setQuickZoom(+e.currentTarget.value || 200)}
            /> %</span
          ></label
        >
        <div class="height-presets">
          {#each [100, 200, 400, 800] as zoom}<button
              class:chosen={p.quickZoomPercent === zoom}
              aria-pressed={p.quickZoomPercent === zoom}
              onclick={() => p.setQuickZoom(zoom)}>{zoom}%</button
            >{/each}
        </div>
        <p>
          Zoom at the clicked point; repeat to restore the previous zoom and pan. Fit, manual zoom,
          scene changes or a resized view start a new toggle. Right hold still opens the dual loupe.
        </p>
      </div>
      <label class="preference"
        ><div>
          <strong>Auto-hide comparison controls</strong>
          <p>Fade the top bar after 2.5 seconds of inactivity. Move the pointer to restore it.</p>
        </div>
        <input
          type="checkbox"
          checked={p.autoHide}
          onchange={(e) => {
            p.autoHide = e.currentTarget.checked;
            p.save();
          }}
        /></label
      >
      <label class="preference"
        ><div>
          <strong>Show helpful tooltips</strong>
          <p>Hover or focus controls for details and current shortcuts.</p>
        </div>
        <input
          type="checkbox"
          checked={p.tooltips}
          onchange={(e) => {
            p.tooltips = e.currentTarget.checked;
            p.save();
          }}
        /></label
      >
      <p class="precision-note">
        Your settings and edited shortcuts stay on this device. Escape restores hidden controls.
      </p>
      {#if p.error}<p class="notice" role="status">{p.error}</p>{/if}
    </div>
  {/if}
</dialog>

<style>
  .settings {
    width: min(760px, calc(100vw - 40px));
    max-height: calc(100vh - 40px);
    padding: 0;
    border-radius: 12px;
    color: #dbe4e5;
    overflow: hidden;
    display: none;
    flex-direction: column;
  }
  .settings[open] {
    display: flex;
  }
  dialog::backdrop {
    background: #030609a8;
    backdrop-filter: blur(5px);
  }
  .heading {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 15px;
    padding: 18px 20px 14px;
    background: #000;
  }
  h2 {
    font-size: 21px;
    font-weight: 500;
    letter-spacing: -0.035em;
    margin: 0 0 4px;
  }
  .heading p {
    color: #8fa39c;
    font-size: 11px;
    margin: 0;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .icon-button {
    background: transparent;
    color: #839e91;
    padding: 6px;
    border-radius: 5px;
  }
  button:hover {
    background: #a9d8cc12;
    color: #d2ebe4;
  }
  .tabs {
    display: flex;
    gap: 18px;
    padding: 0 20px;
    border-bottom: 1px solid #ffffff10;
    flex-shrink: 0;
  }
  .tabs button {
    background: none;
    color: #90a19a;
    padding: 10px 0;
    font-size: 11px;
    border-bottom: 2px solid transparent;
  }
  .tabs button.chosen {
    color: #b5e8da;
    border-bottom-color: #8bd1c4;
  }
  .app-keys {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 10px 20px 0;
    font-size: 10px;
    color: #8fa39c;
    flex-shrink: 0;
  }
  .app-keys button {
    padding: 5px 8px;
    background: #ffffff07;
    border: 1px solid #ffffff0c;
    border-radius: 4px;
    font-size: 10px;
    color: #b1c5bb;
  }
  .app-keys kbd {
    font:
      9px Consolas,
      monospace;
    color: #c6e1d7;
  }
  .zoom-setting {
    padding: 16px 0;
    border-bottom: 1px solid #ffffff14;
  }
  .zoom-enabled,
  .zoom-target {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }
  .zoom-enabled strong {
    font-weight: 500;
  }
  .zoom-enabled input {
    width: 16px;
    height: 16px;
    accent-color: #b7ddd1;
  }
  .zoom-target {
    margin: 12px 0;
    color: #a3b6aa;
  }
  .zoom-target input {
    width: 80px;
    border: 1px solid #ffffff20;
    border-radius: 4px;
    padding: 5px 7px;
    background: #0a0a0a;
    color: #c5e0d1;
    font:
      11px Consolas,
      monospace;
  }
  .zoom-setting p {
    font-size: 11px;
    line-height: 1.5;
    color: #8fa39c;
    margin: 10px 0 0;
  }
  .height-setting {
    padding: 17px 0;
    border-bottom: 1px solid #ffffff14;
  }
  .height-setting label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
  }
  .height-setting output {
    font:
      11px Consolas,
      monospace;
    color: #bfddd0;
  }
  .height-setting input {
    width: 100%;
    margin: 15px 0;
    height: 4px;
    accent-color: #b7ddd1;
  }
  .height-setting p {
    font-size: 11px;
    color: #8fa39c;
    margin: 10px 0 0;
  }
  .height-presets {
    display: flex;
    gap: 6px;
  }
  .height-presets button {
    background: #ffffff05;
    border: 1px solid #ffffff10;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 11px;
    color: #91a79b;
  }
  .height-presets button.chosen {
    border-color: #b7ddd15c;
    color: #c7e7d9;
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px 5px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #ffffff04;
    border: 1px solid #ffffff13;
    padding: 7px 9px;
    border-radius: 6px;
    flex: 1;
    color: #748d87;
  }
  .search input {
    width: 100%;
    background: transparent;
    color: #d2ddd9;
    border: none;
    font-size: 11px;
  }
  .search input:focus {
    outline: none;
  }
  .search:focus-within {
    border-color: #85cdbc;
  }
  .text-button,
  .clear {
    color: #90a69a;
    background: transparent;
    font-size: 10px;
    padding: 6px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .list-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px 4px;
  }
  .list-heading strong {
    font-size: 10px;
    font-weight: 500;
    color: #90b9a8;
  }
  .shortcut-list {
    min-height: 0;
    overflow: auto;
    padding: 0 20px 10px;
  }
  .shortcut-row {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) 160px 36px 24px;
    gap: 8px;
    align-items: center;
    border-bottom: 1px solid #ffffff08;
    padding: 7px 0;
  }
  .shortcut-row strong {
    font-size: 11px;
    font-weight: 500;
  }
  .shortcut-row small {
    display: block;
    color: #85998d;
    font-size: 10px;
    line-height: 1.4;
    margin-top: 2px;
  }
  .binding {
    border: 1px solid #ffffff16;
    border-radius: 5px;
    padding: 6px;
    background: #ffffff04;
    font:
      10px Consolas,
      monospace;
    color: #bfcec9;
    min-height: 28px;
  }
  .binding.recording {
    border-color: #8fd9c6;
    color: #b8f2dc;
    background: #9de6ce14;
  }
  .notice {
    flex-shrink: 0;
    border-top: 1px solid #ffffff0b;
    padding: 10px 20px;
    font-size: 10px;
    line-height: 1.5;
    color: #b0b9a9;
  }
  h3 {
    color: #98c5b3;
    font-size: 11px;
    font-weight: 500;
    margin: 10px 0 5px;
  }
  .guide-switch {
    display: flex;
    gap: 5px;
    padding: 12px 20px 3px;
  }
  .guide-switch button {
    padding: 6px 10px;
    background: #ffffff05;
    color: #90a69c;
    border-radius: 5px;
    font-size: 11px;
  }
  .guide-switch .chosen {
    background: #93dbc519;
    color: #b7e6d7;
  }
  .guide-panel {
    overflow: auto;
    padding: 0 20px 14px;
  }
  section {
    border-bottom: 1px solid #ffffff0b;
    padding: 4px 0 9px;
  }
  section p,
  .preference p {
    font-size: 11px;
    color: #9cafa5;
    line-height: 1.6;
    margin: 4px 0;
  }
  section b {
    color: #cbdad3;
    font-weight: 500;
  }
  .interface-panel {
    padding: 0 20px 16px;
    overflow: auto;
  }
  .preference {
    display: flex;
    gap: 30px;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid #ffffff0b;
  }
  .preference strong {
    font-weight: 500;
    font-size: 12px;
  }
  .preference input {
    width: 16px;
    height: 16px;
    accent-color: #9dddd0;
    flex-shrink: 0;
  }
  .precision-note {
    color: #8da297;
    font-size: 10px;
    line-height: 1.6;
    margin: 12px 0 0;
  }
  .empty-result {
    color: #82958c;
    padding: 20px 0;
    font-size: 12px;
  }
</style>
