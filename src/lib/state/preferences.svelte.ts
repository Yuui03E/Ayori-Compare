import {
  actions,
  chord,
  conflict,
  defaultBindings,
  displayChord,
  readBindings,
  validateChord,
  type Bindings,
} from '../shortcuts';
import { normalizeQuickZoom } from '../right-button-gesture';
const KEY = 'ayori.shortcuts.v1';
const UI_KEY = 'ayori.interface.v1';
export const normalizeBarHeight = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(16, Math.min(44, Math.round(value)))
    : 32;
class Preferences {
  bindings = $state.raw<Bindings>(defaultBindings());
  autoHide = $state(true);
  tooltips = $state(true);
  barHeight = $state(32);
  doubleRightZoom = $state(true);
  quickZoomPercent = $state(200);
  error = $state('');
  constructor() {
    try {
      this.bindings = readBindings(localStorage.getItem(KEY));
      const ui = JSON.parse(localStorage.getItem(UI_KEY) ?? '{}');
      this.autoHide = ui.autoHide !== false;
      this.tooltips = ui.tooltips !== false;
      this.barHeight = normalizeBarHeight(ui.barHeight);
      this.doubleRightZoom = ui.doubleRightZoom !== false;
      this.quickZoomPercent = normalizeQuickZoom(ui.quickZoomPercent);
    } catch {
      /* Storage may be unavailable; defaults still work. */
    }
  }
  label(id: string) {
    return (this.bindings[id] ?? []).map(displayChord).join(' / ');
  }
  hint(id: string) {
    const action = actions.find((a) => a.id === id);
    return `${action?.description ?? ''}${this.label(id) ? `\n${this.label(id)}` : ''}`;
  }
  match(event: KeyboardEvent) {
    const key = chord(event);
    return key ? actions.find((a) => this.bindings[a.id]?.includes(key)) : undefined;
  }
  assign(id: string, key: string) {
    const invalid = validateChord(key, id);
    const used = conflict(this.bindings, id, key);
    if (invalid || used)
      return (
        invalid ?? `Already assigned to “${used!.label}”. Clear or change that shortcut first.`
      );
    this.bindings = { ...this.bindings, [id]: [key] };
    this.save();
    return null;
  }
  clear(id: string) {
    this.bindings = { ...this.bindings, [id]: [] };
    this.save();
  }
  setBarHeight(value: number) {
    this.barHeight = normalizeBarHeight(value);
    this.save();
  }
  setQuickZoom(value: number) {
    this.quickZoomPercent = normalizeQuickZoom(value);
    this.save();
  }
  reset(id?: string) {
    if (!id) this.bindings = defaultBindings();
    else {
      const defaults = defaultBindings()[id];
      const used = defaults.map((key) => conflict(this.bindings, id, key)).find(Boolean);
      if (used) return `Default shortcut is used by “${used.label}”.`;
      this.bindings = { ...this.bindings, [id]: defaults };
    }
    this.save();
    return null;
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 2, bindings: this.bindings }));
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({
          autoHide: this.autoHide,
          tooltips: this.tooltips,
          barHeight: this.barHeight,
          doubleRightZoom: this.doubleRightZoom,
          quickZoomPercent: this.quickZoomPercent,
        }),
      );
      this.error = '';
    } catch {
      this.error = 'Changes work for this session, but could not be saved on this device.';
    }
  }
}
export const preferences = new Preferences();
