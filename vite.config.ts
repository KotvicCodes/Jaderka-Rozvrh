import { defineConfig } from 'vitest/config';

// Served from GitHub Pages at /Jaderka-Rozvrh/; override with BASE_PATH for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/Jaderka-Rozvrh/',
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
});
