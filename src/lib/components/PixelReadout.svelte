<script lang="ts">
  import { workspace as w } from '../state/workspace.svelte';
  let width = $state(1440), height = $state(900);
</script>
<svelte:window bind:innerWidth={width} bind:innerHeight={height}/>
{#if w.grid&&w.pixels.some(Boolean)}
  <div class="readout glass mono" style:left={`${Math.min(w.pointer.x+20,width-286)}px`} style:top={`${Math.min(w.pointer.y+24,height-170)}px`}>
    {#each w.pixels as pixel,i}<section><div class="pixel-head"><b class:b={i===1}>{i===0?'A':'B'}</b>{#if pixel}<span>({pixel.x}, {pixel.y})</span><i style:background={pixel.hex}></i>{:else}<span>Outside source</span>{/if}</div>{#if pixel}<div>RGB8 <span>{pixel.rgb8.join(', ')}</span></div><div>RGB10 <span>{pixel.rgb10.join(', ')}</span></div>{#if pixel.depth===16}<div>RAW16 <span>{pixel.samples.slice(0,3).join(', ')}</span></div>{/if}<div>HEX <span>{pixel.hex}</span></div>{/if}</section>{/each}
  </div>
{/if}
<style>
  .readout{position:absolute;z-index:25;pointer-events:none;border-radius:8px;padding:10px 12px;width:266px;display:flex;gap:14px;font-size:9px;color:#7e918a;box-shadow:0 6px 24px #0008}.readout section{flex:1;min-width:0}.pixel-head{display:flex;align-items:center;gap:6px;border-bottom:1px solid #ffffff0c;padding-bottom:7px;margin-bottom:6px}.pixel-head b{color:#93ddd0}.pixel-head b.b{color:#dcbb80}.pixel-head span{font-size:8px;color:#b6c5bd}.pixel-head i{width:10px;height:10px;border:1px solid #ffffff30;margin-left:auto;border-radius:2px}section>div:not(.pixel-head){line-height:1.9}section>div>span{display:block;color:#c0d2c9;font-size:8px;white-space:nowrap}
</style>
