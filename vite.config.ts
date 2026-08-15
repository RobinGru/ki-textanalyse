import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
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
