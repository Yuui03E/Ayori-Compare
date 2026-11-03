import { build } from 'vite';
await build({
  configFile: false,
  build: {
    target: 'es2022',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: 'src/offline.ts',
      name: 'AyoriOffline',
      formats: ['iife'],
      fileName: () => 'offline.js',
    },
  },
});
