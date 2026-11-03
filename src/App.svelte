<script lang="ts">
  import Titlebar from './lib/components/Titlebar.svelte';
</script>

<Titlebar />
<main>
  <p class="eyebrow">AYORI COMPARE</p>
  <h1>Every pixel tells a story.</h1>
  <p class="muted">A closer look at every encode.</p>
  <div class="glass foundation">The comparison workspace is taking shape.</div>
</main>

<style>
  main { display: grid; place-content: center; text-align: center; height: 100%; background: radial-gradient(ellipse at 50% 40%, #12201f55, transparent 55%); }
  .eyebrow { font-size: 11px; letter-spacing: .24em; color: #87cbbf; }
  h1 { font-size: 38px; font-weight: 500; letter-spacing: -.045em; margin: 16px 0 0; }
  .foundation { border-radius: 14px; padding: 24px 42px; margin-top: 28px; font-size: 13px; color: #a5a5af; }
</style>
