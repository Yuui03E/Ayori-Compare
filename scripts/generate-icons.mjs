import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
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
const result = spawnSync(
  process.execPath,
  [
    'node_modules/@tauri-apps/cli/tauri.js',
    'icon',
    fileURLToPath(source),
    '--output',
    'src-tauri/icons',
    '--ios-color',
    '#000000',
  ],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
