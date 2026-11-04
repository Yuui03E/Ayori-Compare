import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Keep the distributable separate from Cargo's intermediate files and stale shell entries.
if (process.platform === 'win32') {
  const source = new URL('../src-tauri/target/release/ayori-compare.exe', import.meta.url);
  const folder = new URL('../releases/', import.meta.url);
  const destination = new URL('Ayori.exe', folder);
  await mkdir(folder, { recursive: true });
  await copyFile(source, destination);
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const [original, copied] = await Promise.all([readFile(source), readFile(destination)]);
  if (hash(original) !== hash(copied)) throw new Error('Portable copy verification failed.');
  console.log(`Portable Ayori: ${fileURLToPath(destination)}\nSHA-256: ${hash(copied)}`);
}
