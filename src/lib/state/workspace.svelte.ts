import { invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { Image } from '@tauri-apps/api/image';
import type { ComparisonMatrix, Frame, Metric, Mode, Pixel, Point } from '../types';
import { Renderer } from '../webgl/renderer';
import { parseFrame, readPixel } from '../webgl/packet';
import { demoFrame, demoMatrix } from '../demo';
import { loadFramePacket } from '../frame-transport';
import { residentSlots } from '../residency';

export class AyoriWorkspace {
  matrix = $state.raw<ComparisonMatrix | null>(null);
  sceneIndex = $state(0);
  frames = $state.raw<(Frame | null)[]>(Array(8).fill(null));
  errors = $state.raw<Record<number, string>>({});
  scores = $state.raw<Record<number, Metric>>({});
  loading = $state(false);
  importing = $state(false);
  mode = $state<Mode>(0);
  subMode = $state(0);
  slotA = $state(0);
  slotB = $state(1);
  previousSlot = 1;
  zoom = $state(1);
  filter = $state<'auto' | 'nearest' | 'linear'>('auto');
  gain = $state(8);
  bands = $state(32);
  grid = $state(false);
  pixels = $state.raw<(Pixel | null)[]>([null, null]);
  pointer = $state.raw<Point>({ x: 0, y: 0 });
  hudHidden = $state(false);
  hudLocked = $state(false);
  drawer = $state(false);
  help = $state(false);
  sourceBrowser = $state(false);
  pendingSlots = $state.raw<number[]>([]);
  dimensions = $state.raw<([number, number] | null)[]>([]);
  draggingFiles = $state(false);
  message = $state('');
  warnings = $state.raw<string[]>([]);
  fallback = $state(false);
  loadMs = $state(0);
  demo = $state(false);
  metricStatus = $state('');
  renderer: Renderer | null = null;
  epoch = 0;
  private generation = 0;
  private revisions = Array(8).fill(0);
  private metricRevision = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private scoreTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private loads = new Map<number, AbortController>();
  private wanted = new Set<number>();
  private jobs = new Map<number, Promise<void>>();
  private activating = false;
  private dimensionRevision = 0;
  private dimensionTimer: ReturnType<typeof setTimeout> | undefined;

  attach(canvas: HTMLCanvasElement) {
    this.disposed = false;
    this.renderer = new Renderer(canvas);
    this.renderer.onChange = () => {
      this.zoom = this.renderer!.view.zoom;
    };
    this.renderer.onError = (message) => this.notify(message);
  }
  notify(message: string) {
    this.message = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.message = '';
    }, 9000);
  }
  async choose(folders = false, append = false) {
    if (!isTauri()) {
      this.notify('Open the desktop app to load files. You can explore the sample here.');
      return;
    }
    try {
      const paths = await open({
        multiple: true,
        directory: folders,
        title: append ? 'Add comparison sources' : 'Choose comparison sources',
        filters: folders
          ? undefined
          : [{ name: 'Images', extensions: ['png', 'webp', 'avif', 'jpg', 'jpeg'] }],
      });
      if (paths) await this.importPaths(Array.isArray(paths) ? paths : [paths], append);
    } catch (error) {
      this.notify(String(error));
    }
  }
  async importPaths(paths: string[], append = false) {
    if (this.importing) return;
    if (append && this.demo) {
      this.notify('Start a new comparison to load your own files.');
      return;
    }
    this.importing = true;
    try {
      const matrix = await invoke<ComparisonMatrix>('import_sources', { paths, append });
      this.demo = false;
      this.matrix = matrix;
      this.warnings = matrix.warnings;
      this.slotA = 0;
      this.slotB = 1;
      this.previousSlot = 1;
      await this.loadScene(0, true);
      if (matrix.warnings.length) this.notify(matrix.warnings.join(' '));
    } catch (error) {
      this.notify(String(error));
    } finally {
      this.importing = false;
    }
  }
  async showDemo() {
    this.demo = true;
    this.matrix = demoMatrix;
    this.warnings = [];
    this.slotA = 0;
    this.slotB = 1;
    await this.loadScene(0, true);
  }
  async loadScene(index: number, fit = false) {
    if (!this.matrix || !this.renderer || index < 0 || index >= this.matrix.scenes.length) return;
    const token = ++this.generation;
    this.loads.forEach((load) => load.abort());
    this.loads.clear();
    this.jobs.clear();
    this.wanted.clear();
    this.pendingSlots = [];
    this.dimensions = [];
    clearTimeout(this.dimensionTimer);
    this.dimensionRevision++;
    this.activating = true;
    const start = performance.now();
    this.sceneIndex = index;
    this.loading = true;
    this.errors = {};
    this.scores = {};
    this.frames = Array(Math.max(8, this.matrix.sources.length)).fill(null);
    this.revisions = Array(this.frames.length).fill(0);
    this.fallback = false;
    this.pixels = [null, null];
    this.metricStatus = '';
    this.metricRevision++;
    this.refreshTimers.forEach(clearTimeout);
    this.refreshTimers.clear();
    clearTimeout(this.scoreTimer);
    this.renderer.clear();
    this.renderer.view.slotA = this.slotA;
    this.renderer.view.slotB = this.slotB;
    const scene = this.matrix.scenes[index];
    try {
      if (this.demo) {
        for (let slot = 0; slot < 4; slot++) {
          const frame = demoFrame(index, slot);
          this.renderer.upload(slot, frame);
        }
        this.updateFrames();
      } else {
        const active = await invoke<{ epoch: number; warning: string | null }>('activate_scene', {
          index,
        });
        if (token !== this.generation) return;
        this.epoch = active.epoch;
        if (active.warning) this.notify(`Live reload unavailable: ${active.warning}`);
        this.activating = false;
        const sizing =
          this.matrix.sources.length > 8 ? this.inspectDimensions(token) : Promise.resolve();
        await Promise.all([this.ensureResidents(), sizing]);
      }
      if (token !== this.generation) return;
      const valid = this.frames.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
      if (!this.frames[this.slotA] && valid.length) this.select(valid[0]);
      if (!this.frames[this.slotB] && valid.length)
        this.select(valid.find((i) => i !== this.slotA) ?? valid[0], true);
      if (fit) this.renderer.fit();
      this.renderer.invalidate();
      this.loadMs = performance.now() - start;
      this.queueMetrics();
    } catch (error) {
      if (token === this.generation) this.notify(String(error));
    } finally {
      if (token === this.generation) {
        this.loading = false;
        this.activating = false;
      }
    }
  }
  private async inspectDimensions(token: number) {
    const revision = ++this.dimensionRevision;
    try {
      const sizes = await invoke<([number, number] | null)[]>('scene_dimensions', {
        epoch: this.epoch,
      });
      if (token !== this.generation || revision !== this.dimensionRevision || this.disposed) return;
      this.dimensions = sizes;
      this.applyDimensions();
    } catch (error) {
      if (token === this.generation && revision === this.dimensionRevision && !this.disposed)
        throw error;
    }
  }
  private applyDimensions() {
    if (!this.dimensions.length) return;
    this.renderer?.setSceneSize(
      this.dimensions.reduce((max, s) => Math.max(max, s?.[0] ?? 0), 1),
      this.dimensions.reduce((max, s) => Math.max(max, s?.[1] ?? 0), 1),
    );
  }
  /** Reconcile a bounded working set without queuing a decode for every source. */
  private async ensureResidents() {
    if (!this.matrix || !this.renderer || this.activating || this.demo || this.disposed) return;
    const token = this.generation;
    const paths = this.matrix.scenes[this.sceneIndex].frames;
    this.wanted = new Set(
      residentSlots(
        this.matrix.sources.length,
        this.slotA,
        this.slotB,
        this.previousSlot,
        this.mode === 1 && this.subMode === 2,
      ).filter((slot) => paths[slot]),
    );
    this.renderer.frames.forEach((frame, slot) => {
      if (frame && !this.wanted.has(slot)) this.renderer!.remove(slot);
    });
    this.updateFrames();
    while (token === this.generation && !this.disposed) {
      for (const slot of this.wanted) {
        if (this.jobs.size >= 4) break;
        if (this.frames[slot] || this.errors[slot] || this.jobs.has(slot)) continue;
        const job = this.loadSlot(slot, paths[slot]!, token, this.epoch).finally(() => {
          if (this.jobs.get(slot) === job) this.jobs.delete(slot);
        });
        this.jobs.set(slot, job);
      }
      this.pendingSlots = [...this.wanted].filter(
        (slot) => !this.frames[slot] && !this.errors[slot],
      );
      if (!this.jobs.size) break;
      await Promise.race(this.jobs.values());
    }
    if (token === this.generation && !this.disposed) {
      this.updatePixel();
      this.queueMetrics();
    }
  }
  private async loadSlot(slot: number, path: string, token: number, epoch: number, retry = 0) {
    const revision = (this.revisions[slot] = (this.revisions[slot] ?? 0) + 1);
    this.loads.get(slot)?.abort();
    const controller = new AbortController();
    this.loads.set(slot, controller);
    try {
      const lease = await loadFramePacket(path, epoch, controller.signal);
      let adopted = false;
      try {
        if (
          token !== this.generation ||
          revision !== this.revisions[slot] ||
          this.disposed ||
          !this.wanted.has(slot)
        )
          return;
        const frame = parseFrame(lease.buffer);
        frame.release = lease.release;
        this.renderer!.upload(slot, frame);
        if (this.dimensions.length) {
          this.dimensions = this.dimensions.map((size, i) =>
            i === slot ? [frame.width, frame.height] : size,
          );
          this.applyDimensions();
        }
        adopted = true;
      } finally {
        if (!adopted) lease.release();
      }
      const next = { ...this.errors };
      delete next[slot];
      this.errors = next;
      this.updateFrames();
    } catch (error) {
      if (
        token !== this.generation ||
        revision !== this.revisions[slot] ||
        this.disposed ||
        !this.wanted.has(slot)
      )
        return;
      if (retry < 3) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (retry + 1)));
        if (token === this.generation && revision === this.revisions[slot])
          await this.loadSlot(slot, path, token, epoch, retry + 1);
        return;
      }
      this.renderer!.remove(slot);
      this.errors = { ...this.errors, [slot]: String(error) };
      this.updateFrames();
      this.notify(`Source ${slot + 1}: ${error}`);
    } finally {
      if (this.loads.get(slot) === controller) this.loads.delete(slot);
    }
  }
  private updateFrames() {
    this.frames = Array.from(
      { length: Math.max(8, this.matrix?.sources.length ?? 0) },
      (_, i) => this.renderer!.frames[i] ?? null,
    );
    this.fallback = this.renderer!.fallback.some(Boolean);
  }
  onFileChanged(event: { epoch: number; path: string }) {
    if (this.disposed || this.demo || event.epoch !== this.epoch || !this.matrix) return;
    const slot = this.matrix.scenes[this.sceneIndex].frames.indexOf(event.path);
    if (slot < 0) return;
    this.metricRevision++;
    this.scores = {};
    const errors = { ...this.errors };
    delete errors[slot];
    this.errors = errors;
    if (this.matrix.sources.length > 8) {
      this.dimensionRevision++;
      clearTimeout(this.dimensionTimer);
      this.dimensionTimer = setTimeout(
        () =>
          void this.inspectDimensions(this.generation).catch((error) => this.notify(String(error))),
        250,
      );
    }
    if (!this.wanted.has(slot)) return;
    clearTimeout(this.refreshTimers.get(slot));
    const token = this.generation;
    this.refreshTimers.set(
      slot,
      setTimeout(async () => {
        this.refreshTimers.delete(slot);
        await this.loadSlot(slot, event.path, token, event.epoch);
        if (token === this.generation) this.queueMetrics();
      }, 150),
    );
  }
  private queueMetrics() {
    if (this.demo || !this.matrix?.scenes[this.sceneIndex].frames[0] || this.disposed) return;
    clearTimeout(this.scoreTimer);
    const epoch = this.epoch,
      revision = ++this.metricRevision;
    this.metricStatus = 'Measuring…';
    this.scoreTimer = setTimeout(() => {
      const slots =
        this.matrix!.sources.length > 8
          ? [...new Set([this.slotA, this.slotB])].filter((slot) => slot > 0 && !this.scores[slot])
          : undefined;
      if (slots?.length === 0) {
        this.metricStatus = '';
        return;
      }
      void invoke('compute_metrics', { epoch, revision, slots })
        .then(() => {
          if (revision === this.metricRevision) this.metricStatus = '';
        })
        .catch((error) => {
          if (revision === this.metricRevision) this.metricStatus = `Scores unavailable: ${error}`;
        });
    }, 350);
  }
  onMetric(metric: Metric & { epoch: number; revision: number }) {
    if (!this.disposed && metric.epoch === this.epoch && metric.revision === this.metricRevision)
      this.scores = { ...this.scores, [metric.slot]: metric };
  }
  select(slot: number, secondary = false) {
    if (!this.matrix || slot < 0 || slot >= this.matrix.sources.length) return;
    if (secondary) {
      this.slotB = slot;
      if (this.renderer) this.renderer.view.slotB = slot;
    } else {
      if (slot !== this.slotA) this.previousSlot = this.slotA;
      this.slotA = slot;
      if (this.renderer) this.renderer.view.slotA = slot;
    }
    this.renderer?.invalidate();
    this.updatePixel();
    if ((this.matrix?.sources.length ?? 0) > 8) void this.ensureResidents();
  }
  swap() {
    const previous = this.previousSlot;
    this.select(previous);
  }
  cycleSource(step: number, secondary = false) {
    if (this.matrix)
      this.select(
        ((secondary ? this.slotB : this.slotA) + step + this.matrix.sources.length) %
          this.matrix.sources.length,
        secondary,
      );
  }
  scene(step: number) {
    if (this.matrix)
      void this.loadScene(
        (this.sceneIndex + step + this.matrix.scenes.length) % this.matrix.scenes.length,
      );
  }
  setMode(mode: Mode) {
    this.subMode = this.mode === mode ? (this.subMode + 1) % [1, 3, 1, 2, 4][mode] : 0;
    this.mode = mode;
    this.renderer?.setMode(mode, this.subMode);
    if ((this.matrix?.sources.length ?? 0) > 8) void this.ensureResidents();
  }
  setGain(value: number) {
    value = Math.max(1, Math.min(50, value));
    this.gain = value;
    if (this.renderer) {
      this.renderer.view.gain = value;
      this.renderer.invalidate();
    }
  }
  setBands(value: number) {
    value = Math.max(8, Math.min(64, value));
    this.bands = value;
    if (this.renderer) {
      this.renderer.view.bandFrequency = value;
      this.renderer.invalidate();
    }
  }
  setFilter() {
    this.filter =
      this.filter === 'auto' ? 'nearest' : this.filter === 'nearest' ? 'linear' : 'auto';
    if (this.renderer) {
      this.renderer.view.filter = this.filter;
      this.renderer.invalidate();
    }
  }
  toggleGrid() {
    this.grid = !this.grid;
    if (this.renderer) {
      this.renderer.view.grid = this.grid;
      this.renderer.invalidate();
    }
    this.updatePixel();
  }
  fit() {
    this.renderer?.fit();
  }
  setZoom(value: number) {
    this.renderer?.zoomTo(value);
  }
  toggleZoom() {
    if (Math.abs(this.zoom - 1) < 0.001) this.fit();
    else this.setZoom(1);
  }
  toggleHud() {
    this.hudLocked = !this.hudLocked;
    this.hudHidden = this.hudLocked;
  }
  exchangeSources() {
    const a = this.slotA;
    this.select(this.slotB);
    this.select(a, true);
  }
  resetView() {
    this.fit();
    this.setGain(8);
    this.setBands(32);
  }
  move(event: PointerEvent) {
    if (!this.renderer) return;
    this.renderer.view.mouse = this.renderer.point(event);
    this.pointer = { x: event.clientX, y: event.clientY };
    if (this.renderer.view.loupe || this.mode === 1) this.renderer.invalidate();
    this.updatePixel();
  }
  updatePixel() {
    if (!this.grid || !this.renderer) {
      this.pixels = [null, null];
      return;
    }
    const uv = this.renderer.uv();
    this.pixels = [
      this.frames[this.slotA] ? readPixel(this.frames[this.slotA]!, uv) : null,
      this.frames[this.slotB] ? readPixel(this.frames[this.slotB]!, uv) : null,
    ];
  }
  loupe(active: boolean) {
    if (this.renderer) {
      this.renderer.view.loupe = active;
      this.renderer.invalidate();
    }
  }
  async copy() {
    if (!this.renderer || !this.matrix) return;
    try {
      const blob = await this.renderer.capture();
      if (isTauri()) {
        const bitmap = await Image.fromBytes(await blob.arrayBuffer());
        try {
          await writeImage(bitmap);
        } finally {
          await bitmap.close();
        }
      } else await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.notify('Comparison image copied.');
    } catch (error) {
      this.notify(`Could not copy the image: ${error}`);
    }
  }
  async exportHtml() {
    if (!this.matrix) return;
    if (this.demo) {
      this.notify('Load your own images to export a comparison.');
      return;
    }
    try {
      const path = await save({
        defaultPath: 'ayori-comparison.html',
        filters: [{ name: 'Offline comparison', extensions: ['html'] }],
      });
      if (!path) return;
      this.notify('Preparing offline comparison…');
      await invoke('export_html', { path });
      this.notify('Offline comparison saved.');
    } catch (error) {
      this.notify(`Export failed: ${error}`);
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.loads.forEach((load) => load.abort());
    this.loads.clear();
    this.jobs.clear();
    this.wanted.clear();
    this.pendingSlots = [];
    this.metricRevision++;
    this.refreshTimers.forEach(clearTimeout);
    clearTimeout(this.scoreTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.dimensionTimer);
    this.renderer?.dispose();
    this.renderer = null;
    this.frames = Array(8).fill(null);
  }
}
export const workspace = new AyoriWorkspace();
if (import.meta.env.DEV) Reflect.set(window, '__AYORI_WORKSPACE__', workspace);
