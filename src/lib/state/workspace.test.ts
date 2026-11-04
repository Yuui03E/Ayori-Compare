import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComparisonMatrix, Frame } from '../types';
import type { Renderer } from '../webgl/renderer';

const { invoke } = vi.hoisted(() => {
  vi.stubGlobal('window', {});
  return { invoke: vi.fn() };
});
vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri: () => true }));
import { AyoriWorkspace } from './workspace.svelte';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function packet(sample: number) {
  const bytes = new ArrayBuffer(36);
  const view = new DataView(bytes);
  [0x49525941, 1, 1, 8, 4, 0, 8, 0].forEach((v, i) => view.setUint32(i * 4, v, true));
  new Uint8Array(bytes, 32).set([sample, 2, 3, 255]);
  return bytes;
}
const workspaces: AyoriWorkspace[] = [];
function setup() {
  const w = new AyoriWorkspace();
  const frames: (Frame | null)[] = Array(8).fill(null);
  const renderer = {
    frames,
    fallback: Array(8).fill(false),
    view: {},
    clear: () => frames.fill(null),
    upload: vi.fn((slot: number, f: Frame) => {
      frames[slot] = f;
    }),
    remove: vi.fn((slot: number) => {
      frames[slot]?.release?.();
      frames[slot] = null;
    }),
    setSceneSize: vi.fn(),
    setMode: vi.fn(),
    invalidate: vi.fn(),
    fit: vi.fn(),
    dispose: () => frames.fill(null),
  };
  w.renderer = renderer as unknown as Renderer;
  w.matrix = {
    sources: [
      { label: 'A', origin: 'a', kind: 'folder' },
      { label: 'B', origin: 'b', kind: 'folder' },
    ],
    scenes: [
      { id: '0', label: '0', frames: ['a0', 'b0'] },
      { id: '1', label: '1', frames: ['a1', null] },
    ],
    warnings: [],
  } satisfies ComparisonMatrix;
  workspaces.push(w);
  return { w, renderer };
}
afterEach(() => {
  workspaces.splice(0).forEach((w) => w.dispose());
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('asynchronous workspace lifetime', () => {
  it('browses 100 sources with bounded residency and discards results evicted during selection', async () => {
    const { w, renderer } = setup();
    const paths = Array.from({ length: 100 }, (_, i) => `image${i}`);
    w.matrix = {
      sources: paths.map((path) => ({ label: path, origin: path, kind: 'file' })),
      scenes: [{ id: 'all', label: 'All', frames: paths }],
      warnings: [],
    };
    const pending = new Map<string, ReturnType<typeof deferred<ArrayBuffer>>>();
    invoke.mockImplementation((cmd, args) => {
      if (cmd === 'activate_scene') return Promise.resolve({ epoch: 1 });
      if (cmd === 'scene_dimensions') return Promise.resolve(paths.map(() => [1, 1]));
      if (cmd === 'load_frame_binary') {
        if (args.path === 'image50') {
          const request = deferred<ArrayBuffer>();
          pending.set(args.path, request);
          return request.promise;
        }
        return Promise.resolve(packet(Number(args.path.slice(5))));
      }
      return Promise.resolve();
    });
    await w.loadScene(0);
    expect(w.frames.filter(Boolean).length).toBeLessThanOrEqual(8);
    expect(invoke.mock.calls.filter(([cmd]) => cmd === 'load_frame_binary').length).toBe(8);
    w.select(50);
    await vi.waitFor(() => expect(pending.has('image50')).toBe(true));
    w.select(99);
    w.select(90); // 50 is neither selected nor the previous flicker source.
    pending.get('image50')!.resolve(packet(50));
    await vi.waitFor(() => {
      expect(w.frames[90]?.pixels[0]).toBe(90);
      expect(w.pendingSlots).toHaveLength(0);
    });
    expect(w.frames[50]).toBeNull();
    expect(w.frames[99]?.pixels[0]).toBe(99);
    expect(w.frames.filter(Boolean).length).toBeLessThanOrEqual(8);
    expect(
      renderer.upload.mock.calls.every(([slot, frame]) => slot !== 50 || frame.pixels[0] !== 50),
    ).toBe(true);
    w.setMode(1);
    w.setMode(1);
    w.setMode(1);
    await vi.waitFor(() => expect(w.frames.slice(0, 4).every(Boolean)).toBe(true));
    expect(w.frames.filter(Boolean).length).toBeLessThanOrEqual(8);
    expect(renderer.setSceneSize).toHaveBeenCalledWith(1, 1);
  });
  it('discards old scene packets and clears missing slots when loads finish out of order', async () => {
    const { w, renderer } = setup();
    const oldA = deferred<ArrayBuffer>(),
      oldB = deferred<ArrayBuffer>();
    invoke.mockImplementation((command, args) => {
      if (command === 'activate_scene') return Promise.resolve({ epoch: args.index + 1 });
      if (command === 'load_frame_binary')
        return args.path === 'a0'
          ? oldA.promise
          : args.path === 'b0'
            ? oldB.promise
            : Promise.resolve(packet(91));
      return Promise.resolve();
    });
    const old = w.loadScene(0);
    await Promise.resolve();
    await w.loadScene(1);
    oldA.resolve(packet(11));
    oldB.resolve(packet(22));
    await old;
    expect(w.sceneIndex).toBe(1);
    expect(w.frames[0]?.pixels[0]).toBe(91);
    expect(w.frames[1]).toBeNull();
    expect(renderer.upload).toHaveBeenCalledTimes(1);
  });

  it('ignores an older reload completing after a newer reload', async () => {
    vi.useFakeTimers();
    const { w } = setup();
    const older = deferred<ArrayBuffer>(),
      newer = deferred<ArrayBuffer>();
    let calls = 0;
    invoke.mockImplementation((command) => {
      if (command === 'activate_scene') return Promise.resolve({ epoch: 1 });
      if (command === 'load_frame_binary')
        return ++calls === 1
          ? Promise.resolve(packet(1))
          : calls === 2
            ? older.promise
            : newer.promise;
      return Promise.resolve();
    });
    await w.loadScene(1);
    w.onFileChanged({ epoch: 1, path: 'a1' });
    await vi.advanceTimersByTimeAsync(150);
    w.onFileChanged({ epoch: 1, path: 'a1' });
    await vi.advanceTimersByTimeAsync(150);
    newer.resolve(packet(9));
    await vi.advanceTimersByTimeAsync(0);
    older.resolve(packet(3));
    await vi.advanceTimersByTimeAsync(0);
    expect(w.frames[0]?.pixels[0]).toBe(9);
  });

  it('does not upload or accept scores after disposal', async () => {
    const { w, renderer } = setup();
    const data = deferred<ArrayBuffer>();
    invoke.mockImplementation((command) =>
      command === 'activate_scene' ? Promise.resolve({ epoch: 1 }) : data.promise,
    );
    const pending = w.loadScene(1);
    await Promise.resolve();
    const revision = Reflect.get(w, 'metricRevision');
    w.dispose();
    data.resolve(packet(55));
    await pending;
    w.onMetric({ epoch: 1, revision, slot: 1, score: 90, resampled: false });
    expect(renderer.upload).not.toHaveBeenCalled();
    expect(w.frames.every((f) => f === null)).toBe(true);
    expect(w.scores).toEqual({});
  });
});
