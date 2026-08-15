import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    // Full Unicode security tables are intentionally emitted as a separately cacheable data chunk.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes('/src/lib/cleaner/generated-') ? 'unicode-security-data' : undefined;
        }
      }
    }
  },
  test: {
    include: ['src/**/*.test.ts']
  }
});
