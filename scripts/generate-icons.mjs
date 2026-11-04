import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// All native icons derive from the same approved vector used in the interface.
const root = fileURLToPath(new URL('../', import.meta.url));
const mark = await readFile(new URL('../src/lib/assets/ayori.svg', import.meta.url), 'utf8');
const paths = [...mark.matchAll(/<path\b[^>]*\/>/g)].map((m) => m[0]).join('\n    ');
if (!paths) throw new Error('The Ayori master must contain SVG paths.');
const source = new URL('../src-tauri/icons/app-icon.svg', import.meta.url);
await writeFile(
  source,
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100" fill="none">
  <title>Ayori</title>
  <rect x="1" y="1" width="98" height="98" rx="24" fill="#000000" stroke="#2C4036" stroke-width="1"/>
  <g transform="translate(8 8) scale(.84)">
    ${paths}
  </g>
</svg>\n`,
);
const tempRoot = resolve(tmpdir());
const temporary = await mkdtemp(join(tempRoot, 'ayori-icons-'));
try {
  const result = spawnSync(
    process.execPath,
    ['node_modules/@tauri-apps/cli/tauri.js', 'icon', fileURLToPath(source), '--output', temporary],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Icon generation failed (${result.status}).`);
  // Ayori targets Windows and Linux; do not retain unused mobile/macOS/store assets.
  for (const name of [
    '32x32.png',
    '64x64.png',
    '128x128.png',
    '128x128@2x.png',
    'icon.png',
    'icon.ico',
  ])
    await copyFile(join(temporary, name), join(root, 'src-tauri/icons', name));
} finally {
  if (dirname(resolve(temporary)) !== tempRoot || !basename(temporary).startsWith('ayori-icons-'))
    throw new Error('Refusing to remove an unexpected temporary directory.');
  await rm(temporary, { recursive: true, force: true });
}
