import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run in Node.js — this is a server-side service, not a browser app.
    environment: 'node',
    // Each test file gets its own isolated module registry.
    isolate: true,
  },
});
