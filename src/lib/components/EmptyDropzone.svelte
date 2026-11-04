<script lang="ts">
  import { FolderOpen, Images, ArrowUpRight, ScanLine, Keyboard, ArrowLeft } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  import { preferences as p } from '../state/preferences.svelte';
</script>

<main class="empty" class:resumable={!!w.matrix}>
  {#if w.matrix}<button
      class="resume"
      onclick={() => w.resumeComparison()}
      data-tip="Return to your comparison with the same sources, scene, pan and zoom."
      ><ArrowLeft size={15} /><span
        >Resume comparison<small
          >{w.matrix.sources.length} sources · {w.matrix.scenes.length} scenes</small
        ></span
      ></button
    >{/if}
  <div class="intro">
    <div class="eyebrow"><span></span> A CLOSER LOOK</div>
    <h1>Every detail.<br /><span>Side by side.</span></h1>
    <p>
      Find what changed. Keep what matters.<br />Pixel-perfect comparisons for your next encode.
    </p>
  </div>
  <div class="drop-card glass">
    <div class="preview" aria-hidden="true">
      <div class="preview-pane first">
        <div class="sky"></div>
        <div class="sun"></div>
        <div class="mountain back"></div>
        <div class="mountain"></div>
        <span>01</span>
      </div>
      <div class="preview-pane second">
        <div class="sky"></div>
        <div class="sun"></div>
        <div class="mountain back"></div>
        <div class="mountain"></div>
        <span>02</span>
      </div>
      <div class="scan"><ScanLine size={22} /></div>
    </div>
    <h2>Drop your frames here</h2>
    <p>Compare a single frame or an entire collection.</p>
    <div class="actions">
      <button
        class="primary"
        data-tip={p.hint('openImages')}
        onclick={() => w.choose(false)}
        disabled={w.importing}><Images size={15} /> Open images</button
      >
      <button
        class="secondary"
        data-tip={p.hint('openFolders')}
        onclick={() => w.choose(true)}
        disabled={w.importing}><FolderOpen size={15} /> Open folders</button
      >
    </div>
    <div class="import-guide">
      <div>
        <strong>Images → one scene</strong><span
          >Two, ten or 100 alternatives. Choose any pair.</span
        >
      </div>
      <div>
        <strong>Folders → matched scenes</strong><span
          >One folder per release or encoding group.</span
        >
      </div>
    </div>
    <div class="formats mono">PNG <span>·</span> WEBP <span>·</span> AVIF <span>·</span> JPEG</div>
  </div>
  <button
    class="sample"
    disabled={w.importing}
    data-tip="Explore the inspection modes with generated sample images. No files are needed."
    onclick={() => w.showDemo()}>Explore a sample comparison <ArrowUpRight size={14} /></button
  >
  <footer>
    <span>Built for the details you almost missed.</span><button
      data-tip={p.hint('settings')}
      onclick={() => (w.help = true)}><Keyboard size={14} /> Help & shortcuts</button
    >
  </footer>
</main>

<style>
  .empty {
    position: absolute;
    inset: var(--bar-height) 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #000;
    padding-bottom: 30px;
  }
  .resume {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 9px 15px;
    border: 1px solid #b7ddd136;
    border-radius: 6px;
    background: #000;
    color: #b7ddd1;
    margin: 0 0 15px;
    font-size: 12px;
  }
  .resume small {
    display: block;
    color: #85978d;
    font-size: 10px;
    margin-top: 3px;
  }
  .resumable .intro p {
    display: none;
  }
  .resumable .intro {
    margin-bottom: 12px;
  }
  @media (max-height: 700px) {
    .resumable .intro {
      display: none;
    }
  }
  .intro {
    text-align: center;
    margin-bottom: 26px;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.24em;
    font-weight: 600;
    color: #8aaca6;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .eyebrow span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #81d2c6;
    box-shadow: 0 0 12px #81d2c65a;
  }
  h1 {
    font-size: clamp(32px, 4.6vh, 48px);
    line-height: 1.07;
    letter-spacing: -0.055em;
    font-weight: 500;
    margin: 18px 0 16px;
  }
  h1 span {
    color: #969b9f;
  }
  .intro p {
    font-size: 13px;
    line-height: 1.7;
    color: #747b80;
    margin: 0;
  }
  .drop-card {
    width: min(510px, calc(100vw - 48px));
    border-radius: 18px;
    padding: 26px 34px 20px;
    text-align: center;
    border-style: dashed;
    background: #11141699;
  }
  .import-guide {
    display: flex;
    text-align: left;
    gap: 20px;
    margin-top: 23px;
    padding-top: 17px;
    border-top: 1px solid #ffffff0b;
  }
  .import-guide > div {
    flex: 1;
  }
  .import-guide strong {
    color: #b3c5bf;
    font-size: 10px;
    font-weight: 500;
  }
  .import-guide span {
    display: block;
    font-size: 10px;
    color: #758b81;
    line-height: 1.6;
    margin-top: 4px;
  }
  .preview {
    display: flex;
    justify-content: center;
    gap: 10px;
    position: relative;
    margin: 0 auto 22px;
    width: 244px;
    height: 93px;
  }
  .preview-pane {
    position: relative;
    width: 118px;
    border-radius: 7px;
    overflow: hidden;
    border: 1px solid #ffffff15;
    transform: rotate(-5deg);
  }
  .second {
    transform: rotate(5deg);
    filter: saturate(0.55);
  }
  .sky {
    position: absolute;
    inset: 0;
    background: linear-gradient(#28394b, #928883);
  }
  .sun {
    position: absolute;
    background: #dcd0b3;
    top: 18px;
    right: 25px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
  }
  .mountain {
    position: absolute;
    inset: 40px -10px -10px;
    background: #182c30;
    clip-path: polygon(0 75%, 36% 0, 65% 55%, 80% 30%, 100% 70%, 100% 100%, 0 100%);
  }
  .mountain.back {
    background: #455459;
    transform: translate(28px, -13px);
  }
  .preview-pane span {
    position: absolute;
    top: 5px;
    left: 7px;
    font:
      9px Consolas,
      monospace;
    color: #eef5ef99;
  }
  .scan {
    position: absolute;
    left: calc(50% - 19px);
    top: 29px;
    border: 1px solid #3c504c;
    background: #142421;
    color: #98dacd;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    box-shadow: 0 3px 18px #0008;
  }
  h2 {
    font-weight: 500;
    font-size: 17px;
    letter-spacing: -0.025em;
    margin: 0 0 8px;
  }
  .drop-card p {
    font-size: 11px;
    color: #858b90;
    margin: 0 0 23px;
  }
  .actions {
    display: flex;
    justify-content: center;
    gap: 8px;
  }
  .actions button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    border-radius: 7px;
    padding: 10px 17px;
    font-size: 12px;
    font-weight: 500;
  }
  .primary {
    background: #b7ddd1;
    color: #17372d;
  }
  .primary:hover {
    background: #d1ede4;
  }
  .secondary {
    background: #ffffff08;
    border: 1px solid #ffffff13;
    color: #b3b9bb;
  }
  .secondary:hover {
    background: #ffffff12;
  }
  .formats {
    font-size: 9px;
    letter-spacing: 0.12em;
    color: #5a6668;
    margin-top: 21px;
  }
  .formats span {
    padding: 0 8px;
    color: #36423f;
  }
  .sample {
    margin-top: 22px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #87968f;
    background: none;
  }
  .sample:hover {
    color: #c0ded3;
  }
  footer {
    position: absolute;
    bottom: 24px;
    left: 30px;
    right: 30px;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 0.015em;
    color: #535b5c;
  }
  footer button {
    background: none;
    color: #7f8b86;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
  }
  @media (max-height: 700px) {
    .intro {
      margin-bottom: 15px;
    }
    .intro p {
      display: none;
    }
    .drop-card {
      padding-top: 18px;
    }
    .preview {
      height: 65px;
      margin-bottom: 15px;
    }
    .sample {
      margin-top: 14px;
    }
  }
</style>
