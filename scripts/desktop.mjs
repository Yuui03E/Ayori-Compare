import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const env={...process.env};
const nasm=resolve('.tools/nasm-3.02/nasm.exe');
if(process.platform==='win32'&&!env.NASM&&existsSync(nasm))env.NASM=nasm;
// Plain Cargo builds embed the offline viewer too. Build it before starting the dev watcher.
const offline=spawn(process.execPath,['scripts/build-offline.mjs'],{stdio:'inherit',env});
offline.on('exit',code=>{
  if(code){process.exitCode=code;return;}
  const child=spawn(process.execPath,['node_modules/@tauri-apps/cli/tauri.js',...process.argv.slice(2)],{stdio:'inherit',env});
  child.on('exit',code=>{process.exitCode=code??1;});
});
