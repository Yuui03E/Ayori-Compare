<script lang="ts">
  import { X } from '@lucide/svelte';
  import { workspace as w } from '../state/workspace.svelte';
  let dialog: HTMLDialogElement;
  $effect(()=>{if(dialog){if(w.help&&!dialog.open)dialog.showModal();if(!w.help&&dialog.open)dialog.close();}});
  const shortcuts=[['1–8','Select primary source A'],['Alt + 1–8','Select secondary source B'],['Space','Swap current / previous source'],['← / →','Previous / next source'],['↑ / ↓ or [ / ]','Previous / next scene'],['M / S / D / F / B','Swap / curtain / split / diff / banding'],['S, F, B again','Cycle the selected mode’s views'],['Wheel','Zoom around the cursor'],['Left or middle drag','Pan (Ctrl + left in curtain mode)'],['Shift / right hold','Dual-source 8× loupe'],['Z / 0','Toggle fit and physical 100%'],['G','Pixel grid and source readout'],['H','Lock controls hidden / restore'],['Ctrl + C','Copy comparison image'],['Ctrl + E','Export offline HTML'],['Alt + drop','Append sources to the matrix']];
</script>
<dialog bind:this={dialog} onclose={()=>w.help=false} class="glass">
  <div class="heading"><div><span class="eyebrow">AYORI COMPARE</span><h2>Stay in the flow.</h2></div><button aria-label="Close shortcuts" onclick={()=>w.help=false}><X size={18}/></button></div>
  <div class="keys">{#each shortcuts as [key,action]}<div><kbd>{key}</kbd><span>{action}</span></div>{/each}</div>
  <p>Source RGB · SDR interpretation. Source readouts retain original decoded samples. Preview textures may use 8-bit fallback; scores use RGB8 sRGB. Images with profiles or HDR need a color-managed workflow before comparison.</p>
</dialog>
<style>
  dialog{color:#dbe4df;width:600px;max-height:90vh;padding:28px;border-radius:16px;overflow:auto}dialog::backdrop{background:#000a;backdrop-filter:blur(5px)}.heading{display:flex;justify-content:space-between;align-items:start;margin-bottom:22px}.eyebrow{font-size:9px;color:#82ae9c;letter-spacing:.15em}h2{font-size:27px;letter-spacing:-.035em;font-weight:500;margin:8px 0}.heading button{background:none;color:#8b9d95}.keys>div{display:flex;align-items:center;gap:20px;padding:9px 0;border-bottom:1px solid #ffffff06;font-size:11px;color:#a1b0a8}kbd{font:10px Consolas,monospace;width:170px;flex-shrink:0;color:#cee6d8}p{font-size:10px;line-height:1.7;color:#6e8377;margin:22px 0 0}
</style>
