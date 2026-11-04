<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    open = $bindable(false),
    anchor,
    label,
    id,
    children,
  }: {
    open?: boolean;
    anchor: HTMLButtonElement | undefined;
    label: string;
    id: string;
    children: Snippet;
  } = $props();
  let panel: HTMLDivElement;
  function position() {
    if (!panel || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${rect.bottom + 7}px`;
  }
  $effect(() => {
    if (!panel) return;
    if (open && !panel.matches(':popover-open')) {
      panel.showPopover();
    } else if (!open && panel.matches(':popover-open')) panel.hidePopover();
  });
</script>

<svelte:window onresize={position} />
<div
  bind:this={panel}
  {id}
  popover="auto"
  role="dialog"
  aria-label={label}
  data-hud
  onbeforetoggle={(event) => {
    if (event.newState === 'closed') {
      if (panel.contains(document.activeElement)) anchor?.focus();
    }
  }}
  ontoggle={() => {
    const visible = panel.matches(':popover-open');
    if (!visible && panel.contains(document.activeElement)) anchor?.focus();
    open = visible;
    if (visible) {
      position();
      panel.querySelector<HTMLElement>('input,button')?.focus();
    }
  }}
>
  {@render children()}
</div>

<style>
  div {
    position: fixed;
    inset: auto;
    margin: 0;
    width: 300px;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 64px);
    overflow: auto;
    padding: 8px;
    border: 1px solid #9fc9be29;
    border-radius: 9px;
    background: #111a1bfc;
    box-shadow: 0 12px 36px #0009;
    color: #ccdad6;
  }
</style>
