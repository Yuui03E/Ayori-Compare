import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameTransport, type SharedBufferEvent } from './frame-transport';
import { parseFrame, readPixel } from './webgl/packet';
import { Renderer } from './webgl/renderer';

function setup() {
  let receive!: (event: SharedBufferEvent) => void;
  const calls: { command: string; args?: Record<string, unknown> }[] = [];
  const releaseBuffer = vi.fn();
  const call = vi.fn(async <T>(command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    return (command === 'shared_frames_available' ? true : undefined) as T;
  });
  const transport = new FrameTransport((command, args) => call(command, args) as Promise<never>, {
    addEventListener: (_, handler) => {
      receive = handler;
    },
    releaseBuffer,
  });
  const deliver = (request: unknown, buffer: ArrayBuffer) =>
    receive({
      additionalData: { ayori: String(request) },
      getBuffer: () => buffer,
    });
  const requests = () =>
    calls.filter((c) => c.command === 'load_frame_shared').map((c) => c.args!.request);
  return { transport, call, deliver, requests, releaseBuffer };
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
function packet16() {
  const buffer = new ArrayBuffer(40);
  const view = new DataView(buffer);
  [0x49525941, 1, 1, 16, 4, 0, 12, 0].forEach((v, i) => view.setUint32(i * 4, v, true));
  new Uint16Array(buffer, 32).set([771, 12345, 65534, 65535]);
  return buffer;
}
afterEach(() => vi.useRealTimers());

describe('shared frame ownership', () => {
  it('matches out-of-order deliveries, retains all source bits, and releases once', async () => {
    const t = setup();
    const first = t.transport.load('a', 1),
      second = t.transport.load('b', 1);
    await flush();
    const [a, b] = t.requests();
    const bytesA = packet16(),
      bytesB = packet16();
    t.deliver(b, bytesB);
    t.deliver(a, bytesA);
    const [leaseA, leaseB] = await Promise.all([first, second]);
    expect(leaseA.buffer).toBe(bytesA);
    expect(leaseB.buffer).toBe(bytesB);
    const frame = parseFrame(leaseA.buffer);
    expect(frame.originalDepth).toBe(12);
    expect(readPixel(frame, { x: 0, y: 0 })?.samples).toEqual([771, 12345, 65534, 65535]);
    expect(t.releaseBuffer).not.toHaveBeenCalled();
    leaseA.release();
    leaseA.release();
    leaseB.release();
    expect(t.releaseBuffer).toHaveBeenCalledTimes(2);
  });

  it('releases late and unsolicited mappings after cancellation or timeout', async () => {
    vi.useFakeTimers();
    const t = setup(),
      controller = new AbortController();
    const cancelled = t.transport.load('a', 1, controller.signal);
    const rejected = expect(cancelled).rejects.toThrow('cancelled');
    await flush();
    controller.abort();
    await rejected;
    t.deliver(t.requests()[0], packet16());
    const timeout = t.transport.load('b', 1);
    const timedOut = expect(timeout).rejects.toThrow('timed out');
    await flush();
    await vi.advanceTimersByTimeAsync(120_000);
    await timedOut;
    t.deliver(t.requests()[1], packet16());
    t.deliver('unknown', packet16());
    expect(t.releaseBuffer).toHaveBeenCalledTimes(3);
  });

  it('rejects native errors and releases any late delivery', async () => {
    const t = setup();
    t.call.mockImplementation(async (command) => {
      if (command === 'shared_frames_available') return true as never;
      throw new Error('Scene changed.');
    });
    await expect(t.transport.load('a', 1)).rejects.toThrow('Scene changed');
    t.deliver('late', packet16());
    expect(t.releaseBuffer).toHaveBeenCalledTimes(1);
  });

  it('uses unchanged binary packets when the runtime does not support sharing', async () => {
    const t = setup(),
      bytes = packet16();
    t.call.mockImplementation(
      async (command) => (command === 'shared_frames_available' ? false : bytes) as never,
    );
    const frame = await t.transport.load('a', 1);
    expect(frame.buffer).toBe(bytes);
    expect(t.call).toHaveBeenCalledWith('load_frame_binary', { path: 'a', epoch: 1 });
    frame.release();
    expect(t.releaseBuffer).not.toHaveBeenCalled();
  });

  it('renderer clearing releases every retained source mapping', () => {
    const release = vi.fn();
    const renderer = Object.create(Renderer.prototype) as Renderer;
    Object.assign(renderer, {
      gl: { deleteTexture: vi.fn() },
      base: { width: 1, height: 1 },
      textures: Array(8).fill(null),
      frames: Array.from({ length: 8 }, () => ({ ...parseFrame(packet16()), release })),
      fallback: Array(8).fill(false),
      invalidate: vi.fn(),
    });
    renderer.clear();
    renderer.clear();
    expect(release).toHaveBeenCalledTimes(8);
    expect(renderer.frames).toEqual(Array(8).fill(null));
  });
});
