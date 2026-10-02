import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` emits ONE self-contained dist/index.html (Three.js + game inlined),
// so the finished game can be opened straight from disk with no server or internet.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  server: { host: true },
  preview: { host: true },
});
