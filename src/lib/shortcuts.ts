export interface ShortcutAction {
  id: string;
  label: string;
  description: string;
  group: string;
  defaults: string[];
  repeat?: boolean;
  global?: boolean;
  since?: number;
}
const action = (
  id: string,
  label: string,
  description: string,
  group: string,
  defaults: string[],
  extra: Partial<ShortcutAction> = {},
): ShortcutAction => ({ id, label, description, group, defaults, ...extra });
export const actions: ShortcutAction[] = [
  action(
    'home',
    'Home',
    'Go to Home; the current comparison stays ready to resume.',
    'Application',
    ['Alt+Home'],
    { global: true, since: 2 },
  ),
  action(
    'maximize',
    'Maximize / restore',
    'Toggle between a maximized window and its previous size.',
    'Application',
    ['F10'],
    { global: true, since: 2 },
  ),
  action('minimize', 'Minimize', 'Minimize Ayori to the taskbar.', 'Application', ['Ctrl+m'], {
    global: true,
    since: 2,
  }),
  action('quit', 'Quit Ayori', 'Close Ayori. Source files stay unchanged.', 'Application', ['q'], {
    global: true,
    since: 2,
  }),
  action(
    'openImages',
    'Open images',
    'Compare individual images as alternatives of one scene.',
    'Workspace',
    ['Ctrl+o'],
    { global: true },
  ),
  action(
    'openFolders',
    'Open source folders',
    'Match frames across releases or encoding groups by filename or frame number.',
    'Workspace',
    ['Ctrl+Shift+o'],
    { global: true },
  ),
  action(
    'append',
    'Add sources',
    'Add more images or source folders to the current comparison.',
    'Workspace',
    ['Ctrl+Alt+o'],
  ),
  action(
    'sources',
    'Browse sources',
    'Search every source and choose any image for A or B.',
    'Workspace',
    ['Ctrl+k'],
  ),
  action('scenes', 'Browse scenes', 'Open or close the scene list.', 'Workspace', ['v']),
  action(
    'settings',
    'Help & shortcuts',
    'Essential shortcuts, app and comparison guides, and interface preferences.',
    'Workspace',
    ['Ctrl+,', 'F1', 'Shift+/'],
    { global: true },
  ),
  action(
    'copy',
    'Copy PNG',
    'Copy the displayed comparison to the clipboard as a lossless image.',
    'Workspace',
    ['Ctrl+c'],
  ),
  action(
    'export',
    'Export HTML',
    'Save all scenes and sources as one self-contained offline comparison.',
    'Workspace',
    ['Ctrl+e'],
  ),
  action(
    'previousSource',
    'Previous source A',
    'Select the previous image while keeping your view.',
    'Navigation',
    ['ArrowLeft'],
    { repeat: true },
  ),
  action(
    'nextSource',
    'Next source A',
    'Select the next image while keeping your view.',
    'Navigation',
    ['ArrowRight'],
    { repeat: true },
  ),
  action(
    'previousB',
    'Previous source B',
    'Move the secondary comparison to the previous image.',
    'Navigation',
    ['Alt+ArrowLeft'],
    { repeat: true },
  ),
  action(
    'nextB',
    'Next source B',
    'Move the secondary comparison to the next image.',
    'Navigation',
    ['Alt+ArrowRight'],
    { repeat: true },
  ),
  action('firstSource', 'First source A', 'Jump to the first source.', 'Navigation', ['Home']),
  action(
    'lastSource',
    'Last source A',
    'Jump to the last source, even in a large collection.',
    'Navigation',
    ['End'],
  ),
  action(
    'previousScene',
    'Previous scene',
    'Load the previous matched frame.',
    'Navigation',
    ['ArrowUp', '['],
    { repeat: true },
  ),
  action(
    'nextScene',
    'Next scene',
    'Load the next matched frame.',
    'Navigation',
    ['ArrowDown', ']'],
    { repeat: true },
  ),
  action(
    'flicker',
    'Flicker previous source',
    'Alternate between source A and the previously viewed source.',
    'Navigation',
    ['Space'],
  ),
  action(
    'exchange',
    'Exchange A and B',
    'Swap the primary and secondary comparison sources.',
    'Navigation',
    ['x'],
  ),
  ...Array.from({ length: 8 }, (_, i) =>
    action(
      `source${i}`,
      `Source A: ${i + 1}`,
      `Select source ${i + 1} as the primary image. Use Browse sources for any other image.`,
      'Direct source selection',
      [String(i + 1)],
    ),
  ),
  ...Array.from({ length: 8 }, (_, i) =>
    action(
      `secondary${i}`,
      `Source B: ${i + 1}`,
      `Select source ${i + 1} as the secondary image.`,
      'Direct source selection',
      [`Alt+${i + 1}`],
    ),
  ),
  action(
    'mode0',
    'Instant swap',
    'Show source A; flicker between images to spot fine changes.',
    'Inspection',
    ['m'],
  ),
  action(
    'mode1',
    'Curtain',
    'Move the cursor to reveal A/B; repeat to cycle vertical, horizontal and four quadrants (sources 1–4).',
    'Inspection',
    ['s'],
  ),
  action(
    'mode2',
    'Side by side',
    'Show A and B with the same pan and zoom in synchronized panels.',
    'Inspection',
    ['d'],
  ),
  action(
    'mode3',
    'Difference',
    'Show amplified RGB differences; repeat for a luma-error heatmap.',
    'Inspection',
    ['f'],
  ),
  action(
    'mode4',
    'Banding & planes',
    'Cycle contours, shadow boost, luma and chroma inspection.',
    'Inspection',
    ['b'],
  ),
  action(
    'loupe',
    'Hold dual loupe',
    'Hold to magnify A and B together at 8× using exact nearest sampling.',
    'Inspection',
    ['Shift'],
  ),
  action(
    'grid',
    'Pixel grid & readout',
    'Show exact source values; the texel grid appears at 800% zoom.',
    'Inspection',
    ['g'],
  ),
  action(
    'gainUp',
    'Increase difference gain',
    'Amplify differences by one step, up to 50×.',
    'Inspection',
    ['Shift+='],
    { repeat: true },
  ),
  action(
    'gainDown',
    'Decrease difference gain',
    'Reduce difference amplification, down to 1×.',
    'Inspection',
    ['Shift+-'],
    { repeat: true },
  ),
  action(
    'bandsUp',
    'Increase contour frequency',
    'Reveal finer banding steps, up to 64×.',
    'Inspection',
    ['Alt+='],
    { repeat: true },
  ),
  action(
    'bandsDown',
    'Decrease contour frequency',
    'Reduce contour frequency, down to 8×.',
    'Inspection',
    ['Alt+-'],
    { repeat: true },
  ),
  action(
    'zoomIn',
    'Zoom in',
    'Increase magnification by 1.25× around the viewport center.',
    'View',
    ['='],
    { repeat: true },
  ),
  action(
    'zoomOut',
    'Zoom out',
    'Reduce magnification by 1.25× around the viewport center.',
    'View',
    ['-'],
    { repeat: true },
  ),
  action(
    'toggleZoom',
    'Toggle fit / 100%',
    'Alternate between fit-to-window and physical pixel zoom.',
    'View',
    ['z', '0'],
  ),
  action(
    'fit',
    'Fit to window',
    'Center the whole comparison and fit it inside the viewport.',
    'View',
    ['Ctrl+0'],
  ),
  action(
    'actualSize',
    '100% physical pixels',
    'Show one base image pixel per physical display pixel.',
    'View',
    ['Ctrl+1'],
  ),
  action(
    'resetView',
    'Reset view',
    'Fit the comparison and restore default difference gain and contour frequency.',
    'View',
    ['r'],
  ),
  action(
    'filter',
    'Cycle image filtering',
    'Choose automatic, nearest-pixel or smooth bilinear filtering.',
    'View',
    ['i'],
  ),
  action(
    'hide',
    'Hide / show controls',
    'Lock the controls hidden for an unobstructed view; press again to restore.',
    'View',
    ['h'],
  ),
];
export type Bindings = Record<string, string[]>;
export const defaultBindings = (): Bindings =>
  Object.fromEntries(actions.map((a) => [a.id, [...a.defaults]]));
export function chord(
  event: Pick<
    KeyboardEvent,
    'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'isComposing'
  >,
): string | null {
  if (event.isComposing || ['Dead', 'Unidentified', 'Process'].includes(event.key)) return null;
  if (['Control', 'Meta', 'Alt'].includes(event.key)) return null;
  if (event.key === 'Shift') return event.ctrlKey || event.altKey || event.metaKey ? null : 'Shift';
  const symbols: Record<string, string> = {
    Equal: '=',
    Minus: '-',
    Slash: '/',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Period: '.',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
  };
  let key =
    symbols[event.code] ??
    (event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toLowerCase() : event.key);
  if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  return [
    ...(event.ctrlKey || event.metaKey ? ['Ctrl'] : []),
    ...(event.altKey ? ['Alt'] : []),
    ...(event.shiftKey ? ['Shift'] : []),
    key,
  ].join('+');
}
export const displayChord = (value: string) =>
  value
    .split('+')
    .map(
      (part) =>
        ({ ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', '=': '=', ' ': 'Space' })[
          part
        ] ?? (part.length === 1 ? part.toUpperCase() : part),
    )
    .join(' + ');
export function conflict(bindings: Bindings, id: string, key: string) {
  return actions.find((a) => a.id !== id && bindings[a.id]?.includes(key));
}
export function validateChord(key: string, id: string): string | null {
  if (
    !/^(Ctrl\+)?(Alt\+)?(Shift\+)?([a-z0-9=\-\/\[\],.\\;'`]|Space|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|F([1-9]|1[0-2])|Tab|Escape|Shift)$/.test(
      key,
    )
  )
    return 'Choose a letter, number, function key or navigation key, optionally with Ctrl, Alt or Shift.';
  if (
    [
      'Escape',
      'Ctrl+w',
      'Ctrl+Shift+w',
      'Ctrl+r',
      'Ctrl+Shift+r',
      'Ctrl+F4',
      'Alt+F4',
      'F5',
      'F11',
      'F12',
      'Ctrl+Tab',
      'Ctrl+Shift+Tab',
      'Ctrl+Shift+i',
      'Ctrl+Shift+j',
    ].includes(key)
  )
    return 'This combination is reserved by the window or browser.';
  if (key === 'Shift' && id !== 'loupe')
    return 'A modifier on its own can only be used for the held loupe.';
  if (key === 'Tab' || key === 'Shift+Tab')
    return 'Tab is reserved for moving keyboard focus between controls.';
  return null;
}
export function readBindings(raw: string | null): Bindings {
  const bindings = defaultBindings();
  if (!raw) return bindings;
  try {
    const data = JSON.parse(raw);
    if (![1, 2].includes(data.version) || !data.bindings || typeof data.bindings !== 'object')
      return bindings;
    const next: Bindings = {};
    const seen = new Set<string>();
    const added: ShortcutAction[] = [];
    for (const a of actions) {
      if (!Object.hasOwn(data.bindings, a.id) && (a.since ?? 1) > data.version) {
        added.push(a);
        continue;
      }
      const values = data.bindings[a.id];
      if (
        !Array.isArray(values) ||
        values.length > 4 ||
        values.some((v) => typeof v !== 'string' || v.length > 60)
      )
        return bindings;
      next[a.id] = values;
      for (const key of values) {
        if (seen.has(key) || validateChord(key, a.id)) return bindings;
        seen.add(key);
      }
    }
    // New defaults never steal a key from an existing customization.
    for (const a of added) {
      next[a.id] = a.defaults.filter((key) => !seen.has(key));
      next[a.id].forEach((key) => seen.add(key));
    }
    return next;
  } catch {
    return bindings;
  }
}
