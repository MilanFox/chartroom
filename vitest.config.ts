import { defineVitestProject } from '@nuxt/test-utils/config';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => ({
  test: {
    projects: [
      await defineVitestProject({
        test: {
          name: 'app',
          environment: 'nuxt',
          include: ['app/**/*.spec.ts'],
          setupFiles: ['app/test/happy-dom-node-name.ts'],
        },
      }),
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/test/**/*.spec.ts'],
          globalSetup: ['server/test/build-once.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        resolve: { alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
        test: {
          name: 'server-unit',
          environment: 'node',
          include: ['server/utils/**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.spec.ts'],
        },
      },
    ],
  },
}));
