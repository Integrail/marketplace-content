import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const catalogDir = path.resolve(__dirname, 'catalog');

export default defineConfig({
  root: 'src/preview',
  plugins: [
    react(),
    // Watch the catalog directory (outside Vite root) and trigger a full
    // page reload whenever any catalog file is added, changed, or removed.
    {
      name: 'watch-catalog',
      configureServer(server) {
        server.watcher.add(catalogDir);
        const reload = (file: string) => {
          if (file.startsWith(catalogDir)) {
            server.ws.send({ type: 'full-reload' });
          }
        };
        server.watcher.on('change', reload);
        server.watcher.on('add', reload);
        server.watcher.on('unlink', reload);
      },
    },
  ],
  server: {
    fs: { allow: ['../..'] },
  },
});
