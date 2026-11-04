import { describe, expect, it } from 'vitest';
import {
  actions,
  chord,
  conflict,
  defaultBindings,
  readBindings,
  validateChord,
} from './shortcuts';
const keyEvent = (key: string, code: string, extra = {}) => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  isComposing: false,
  ...extra,
});
describe('custom shortcut correctness', () => {
  it('keeps modifiers distinct, handles shifted symbols and ignores IME composition', () => {
    expect(chord(keyEvent('O', 'KeyO', { shiftKey: true, ctrlKey: true }))).toBe('Ctrl+Shift+o');
    expect(chord(keyEvent('?', 'Slash', { shiftKey: true }))).toBe('Shift+/');
    expect(chord(keyEvent('+', 'Equal', { shiftKey: true }))).toBe('Shift+=');
    expect(chord(keyEvent('Dead', 'KeyA'))).toBeNull();
    expect(chord(keyEvent('a', 'KeyA', { isComposing: true }))).toBeNull();
    expect(chord(keyEvent('Shift', 'ShiftLeft'))).toBe('Shift');
  });
  it('has unique valid defaults and detects conflicts before replacing shortcuts', () => {
    const bindings = defaultBindings();
    const keys = Object.values(bindings).flat();
    expect(new Set(keys).size).toBe(keys.length);
    for (const action of actions)
      for (const key of action.defaults) expect(validateChord(key, action.id)).toBeNull();
    expect(conflict(bindings, 'grid', 'm')?.id).toBe('mode0');
    expect(conflict(bindings, 'grid', 'g')).toBeUndefined();
    expect(validateChord('Tab', 'grid')).toContain('focus');
    expect(validateChord('Alt+F4', 'grid')).toContain('reserved');
  });
  it('round trips edits and cleared actions; recovers from corrupt, duplicate or reserved saved assignments', () => {
    const bindings = { ...defaultBindings(), grid: ['Ctrl+g'], fit: [] };
    const saved = (b: unknown) => JSON.stringify({ version: 1, bindings: b });
    expect(readBindings(saved(bindings))).toEqual(bindings);
    expect(readBindings('{bad')).toEqual(defaultBindings());
    expect(readBindings(saved({ ...bindings, grid: ['m'] }))).toEqual(defaultBindings());
    expect(readBindings(saved({ ...bindings, grid: ['Alt+F4'] }))).toEqual(defaultBindings());
  });
});

describe('shortcut schema migration', () => {
  it('adds app keys without erasing old edits or taking their keys', () => {
    const legacy = Object.fromEntries(
      actions.filter((a) => !a.since).map((a) => [a.id, [...a.defaults]]),
    );
    legacy.grid = ['q'];
    legacy.fit = [];
    const migrated = readBindings(JSON.stringify({ version: 1, bindings: legacy }));
    expect(migrated.grid).toEqual(['q']);
    expect(migrated.fit).toEqual([]);
    expect(migrated.quit).toEqual([]);
    expect(migrated.maximize).toEqual(['F10']);
    expect(migrated.home).toEqual(['Alt+Home']);
    expect(new Set(Object.values(migrated).flat()).size).toBe(
      Object.values(migrated).flat().length,
    );
  });
  it('retains edited and cleared application commands in version 2', () => {
    const bindings = { ...defaultBindings(), quit: ['Ctrl+q'], minimize: [] };
    expect(readBindings(JSON.stringify({ version: 2, bindings }))).toEqual(bindings);
  });
});
