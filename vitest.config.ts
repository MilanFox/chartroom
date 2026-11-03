import { defineVitestProject } from '@nuxt/test-utils/config';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => ({
  test: {
    projects: [
      await defineVitestProject({
        test: {
          name: 'app',
          environment: 'nuxt',
          include: ['app/**/*.spec.ts'],
        },
      }),
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.spec.ts'],
          globalSetup: ['server/test/build-once.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
}));
