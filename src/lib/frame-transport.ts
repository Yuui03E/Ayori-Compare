import { invoke } from '@tauri-apps/api/core';

export interface PacketLease {
  buffer: ArrayBuffer;
  release: () => void;
}
export interface SharedBufferEvent {
  additionalData?: { ayori?: string };
  getBuffer: () => ArrayBuffer;
}
export interface WebViewBridge {
  addEventListener: (
    name: 'sharedbufferreceived',
    listener: (e: SharedBufferEvent) => void,
  ) => void;
  releaseBuffer: (buffer: ArrayBuffer) => void;
}
type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export class FrameTransport {
  private supported?: Promise<boolean>;
  private pending = new Map<
    string,
    { resolve: (lease: PacketLease) => void; reject: (e: Error) => void }
  >();
  constructor(
    private call: Invoke,
    private bridge?: WebViewBridge,
  ) {
    bridge?.addEventListener('sharedbufferreceived', (event) => {
      const buffer = event.getBuffer();
      const request = event.additionalData?.ayori ?? '';
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          bridge.releaseBuffer(buffer);
          // Acknowledge only after WebView2 detaches every JS view. The native
          // side can then reuse one bounded idle allocation for a future frame.
          void this.call('release_shared_frame', { request }).catch(() => {});
        }
      };
      const waiter = this.pending.get(request);
      if (waiter) waiter.resolve({ buffer, release });
      else release(); // Cancelled, timed out, or from a previous page lifetime.
    });
  }

  async load(path: string, epoch: number, signal?: AbortSignal): Promise<PacketLease> {
    signal?.throwIfAborted();
    this.supported ??= this.bridge
      ? this.call<boolean>('shared_frames_available').catch(() => false)
      : Promise.resolve(false);
    const supported = await this.supported;
    signal?.throwIfAborted();
    if (!supported) {
      const buffer = await this.call<ArrayBuffer>('load_frame_binary', { path, epoch });
      signal?.throwIfAborted();
      return { buffer, release: () => {} };
    }
    const request = crypto.randomUUID();
    return new Promise<PacketLease>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        this.pending.delete(request);
      };
      const abort = () => {
        cleanup();
        reject(new DOMException('Frame load cancelled.', 'AbortError'));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Frame delivery timed out.'));
      }, 120_000);
      signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(request, {
        resolve: (lease) => {
          cleanup();
          resolve(lease);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
      });
      // The event owns the buffer. No binary data crosses the command response.
      void this.call('load_frame_shared', { path, epoch, request }).catch((error) => {
        this.pending.get(request)?.reject(error);
      });
    });
  }
}

let transport: FrameTransport | undefined;
export function loadFramePacket(path: string, epoch: number, signal?: AbortSignal) {
  const bridge = (window as unknown as { chrome?: { webview?: WebViewBridge } }).chrome?.webview;
  transport ??= new FrameTransport(invoke, bridge?.releaseBuffer ? bridge : undefined);
  return transport.load(path, epoch, signal);
}
