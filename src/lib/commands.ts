import { workspace as w } from './state/workspace.svelte';
import type { Mode } from './types';
export function runCommand(id: string) {
  if (/^source\d$/.test(id)) return w.select(Number(id.slice(6)));
  if (id.startsWith('secondary')) return w.select(Number(id.slice(9)), true);
  if (id.startsWith('mode')) return w.setMode(Number(id.slice(4)) as Mode);
  const commands: Record<string, () => void> = {
    openImages: () => void w.choose(),
    openFolders: () => void w.choose(true),
    append: () => void w.choose(w.matrix?.sources[0].kind === 'folder', true),
    sources: () => {
      w.sourceBrowser = true;
    },
    scenes: () => {
      w.drawer = !w.drawer;
    },
    settings: () => {
      w.loupe(false);
      w.help = true;
    },
    copy: () => void w.copy(),
    export: () => void w.exportHtml(),
    previousSource: () => w.cycleSource(-1),
    nextSource: () => w.cycleSource(1),
    previousB: () => w.cycleSource(-1, true),
    nextB: () => w.cycleSource(1, true),
    firstSource: () => w.select(0),
    lastSource: () => w.select(w.matrix!.sources.length - 1),
    previousScene: () => w.scene(-1),
    nextScene: () => w.scene(1),
    flicker: () => w.swap(),
    exchange: () => w.exchangeSources(),
    grid: () => w.toggleGrid(),
    gainUp: () => w.setGain(w.gain + 1),
    gainDown: () => w.setGain(w.gain - 1),
    bandsUp: () => w.setBands(w.bands + 1),
    bandsDown: () => w.setBands(w.bands - 1),
    zoomIn: () => w.setZoom(w.zoom * 1.25),
    zoomOut: () => w.setZoom(w.zoom / 1.25),
    toggleZoom: () => w.toggleZoom(),
    fit: () => w.fit(),
    actualSize: () => w.setZoom(1),
    resetView: () => w.resetView(),
    filter: () => w.setFilter(),
    hide: () => w.toggleHud(),
  };
  commands[id]?.();
}
