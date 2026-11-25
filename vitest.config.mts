import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const alias = {
  '@': path.resolve(import.meta.dirname, '.'),
  'server-only': path.resolve(import.meta.dirname, 'tests/empty-module.ts'),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['tests/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['tests/**/*.test.tsx'] },
      },
    ],
  },
});
