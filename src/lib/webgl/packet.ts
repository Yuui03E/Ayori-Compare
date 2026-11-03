import type { Frame, Pixel, Point } from '../types';

export function parseFrame(buffer: ArrayBuffer): Frame {
  if (buffer.byteLength < 32) throw new Error('Truncated image packet.');
  const header = new DataView(buffer);
  if (header.getUint32(0, true) !== 0x49525941) throw new Error('Invalid image packet.');
  const width = header.getUint32(4, true),
    height = header.getUint32(8, true);
  const depth = header.getUint32(12, true),
    channels = header.getUint32(16, true);
  if (
    !width ||
    !height ||
    width > 32768 ||
    height > 32768 ||
    channels !== 4 ||
    (depth !== 8 && depth !== 16)
  )
    throw new Error('Unsupported image dimensions or pixel format.');
  const bytes = width * height * 4 * (depth / 8);
  if (bytes + 32 !== buffer.byteLength)
    throw new Error('Image packet length does not match its dimensions.');
  return {
    width,
    height,
    depth,
    originalDepth: header.getUint32(24, true),
    fileSize: header.getUint32(20, true),
    pixels: depth === 16 ? new Uint16Array(buffer, 32) : new Uint8Array(buffer, 32),
  };
}

export function readPixel(frame: Frame, uv: Point): Pixel | null {
  if (uv.x < 0 || uv.y < 0 || uv.x >= 1 || uv.y >= 1) return null;
  const x = Math.floor(uv.x * frame.width),
    y = Math.floor(uv.y * frame.height);
  const offset = (y * frame.width + x) * 4;
  const samples = Array.from(frame.pixels.subarray(offset, offset + 4));
  const maximum = frame.depth === 16 ? 65535 : 255;
  const rgb8 = samples.slice(0, 3).map((v) => Math.round((v * 255) / maximum));
  const rgb10 = samples.slice(0, 3).map((v) => Math.round((v * 1023) / maximum));
  return {
    x,
    y,
    samples,
    rgb8,
    rgb10,
    hex:
      '#' +
      rgb8
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase(),
    depth: frame.depth,
  };
}
