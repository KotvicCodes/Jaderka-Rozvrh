import { defineConfig } from 'vitest/config';

// Served from GitHub Pages at /Jadernacky-Rozvrh/ (the deploy workflow sets BASE_PATH from the repo name);
// override with BASE_PATH for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/Jadernacky-Rozvrh/',
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
});
