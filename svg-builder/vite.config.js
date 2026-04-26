import { defineConfig } from 'vite';
import pugPlugin from 'vite-plugin-pug';

export default defineConfig({
    plugins: [pugPlugin()],
    build: {
        outDir: '../svg-builder-tool',
        emptyOutDir: true,
    },
    server: {
        open: true,
    },
    optimizeDeps: {
        needsInterop: ['svgo']
    },
    base: './',
});