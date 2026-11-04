// Regenerates original, tiny YUV fixtures; libavif is only a fixture-authoring tool.
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const encoder = resolve(process.argv[2] ?? '.tools/libavif-1.4.2/avifenc.exe');
const output = resolve('src-tauri/tests/fixtures');
await mkdir(output, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'ayori-yuv-'));
try {
  for (const depth of [8, 10, 12])
    for (const format of [420, 422, 444])
      for (const range of ['full', 'limited']) {
        const width = 32,
          height = 16,
          scale = 2 ** (depth - 8),
          max = 2 ** depth - 1;
        const chromaWidth = format === 444 ? width : width / 2;
        const chromaHeight = format === 420 ? height / 2 : height;
        const chroma = depth === 8 ? String(format) : `${format}p${depth}`;
        const planes = [];
        for (let plane = 0; plane < 3; plane++) {
          const w = plane ? chromaWidth : width,
            h = plane ? chromaHeight : height;
          const bytes = Buffer.alloc(w * h * (depth === 8 ? 1 : 2));
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const block = Math.floor((x * width) / w / 8);
              const value =
                plane === 0
                  ? range === 'limited'
                    ? 16 * scale + Math.round((y * 219 * scale) / 15)
                    : Math.round((y * max) / 15)
                  : (plane === 1 ? [128, 96, 160, 128] : [128, 128, 128, 160])[block] * scale;
              if (depth === 8) bytes[y * w + x] = value;
              else bytes.writeUInt16LE(value, (y * w + x) * 2);
            }
          planes.push(bytes);
        }
        const input = join(temp, 'input.y4m');
        await writeFile(
          input,
          Buffer.concat([
            Buffer.from(
              `YUV4MPEG2 W${width} H${height} F1:1 Ip A1:1 C${chroma} XCOLORRANGE=${range.toUpperCase()}\nFRAME\n`,
            ),
            ...planes,
          ]),
        );
        execFileSync(
          encoder,
          [
            '--qcolor',
            '100',
            '--cicp',
            '1/13/1',
            '--speed',
            '10',
            '--jobs',
            '2',
            input,
            join(output, `yuv${format}-${depth}-${range}.avif`),
          ],
          { stdio: 'pipe', windowsHide: true },
        );
      }
} finally {
  if (dirname(resolve(temp)) !== resolve(tmpdir()) || !basename(temp).startsWith('ayori-yuv-'))
    throw Error('Unexpected fixture temporary directory');
  await rm(temp, { recursive: true, force: true });
}
console.log('Generated 18 original Rec.709 YUV fixtures (8/10/12-bit, 420/422/444, full/limited).');
