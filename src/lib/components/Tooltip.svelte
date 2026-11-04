<script lang="ts">
  import { onMount } from 'svelte';
  import { preferences as p } from '../state/preferences.svelte';
  let node: HTMLDivElement;
  let content = $state('');
  let x = $state(0),
    y = $state(0);
  onMount(() => {
    let timer: ReturnType<typeof setTimeout>;
    let target: HTMLElement | null = null;
    let oldDescription: string | null = null;
    function hide() {
      clearTimeout(timer);
      if (node.matches(':popover-open')) node.hidePopover();
      if (target) {
        if (oldDescription) target.setAttribute('aria-describedby', oldDescription);
        else target.removeAttribute('aria-describedby');
      }
      target = null;
    }
    function show(event: Event) {
      const next = (event.target as Element)?.closest<HTMLElement>('[data-tip]');
      if (!next || next === target) return;
      hide();
      if (!p.tooltips || !next.dataset.tip) return;
      target = next;
      oldDescription = next.getAttribute('aria-describedby');
      timer = setTimeout(
        () => {
          if (!target?.isConnected || !p.tooltips) return;
          content = target.dataset.tip ?? '';
          node.textContent = content;
          node.showPopover();
          const rect = target.getBoundingClientRect(),
            box = node.getBoundingClientRect();
          x = Math.max(
            12,
            Math.min(
              window.innerWidth - box.width - 12,
              rect.left + rect.width / 2 - box.width / 2,
            ),
          );
          y =
            rect.bottom + box.height + 18 < window.innerHeight
              ? rect.bottom + 10
              : Math.max(12, rect.top - box.height - 10);
          target.setAttribute('aria-describedby', `${oldDescription ?? ''} ayori-tooltip`.trim());
        },
        event.type === 'focusin' ? 100 : 450,
      );
    }
    function leave(event: Event) {
      if (target && !target.contains((event as MouseEvent).relatedTarget as Node | null)) hide();
    }
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', hide, true);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', hide, true);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  });
</script>

<div
  bind:this={node}
  id="ayori-tooltip"
  role="tooltip"
  popover="manual"
  style:left={`${x}px`}
  style:top={`${y}px`}
>
  {content}
</div>

<style>
  div {
    position: fixed;
    margin: 0;
    inset: auto;
    max-width: min(290px, calc(100vw - 24px));
    padding: 8px 10px;
    border: 1px solid #badfd72b;
    border-radius: 6px;
    background: #080808;
    color: #d3e4de;
    font:
      11px/1.45 'Segoe UI',
      sans-serif;
    box-shadow: 0 7px 25px #0008;
    white-space: pre-line;
    pointer-events: none;
  }
</style>
