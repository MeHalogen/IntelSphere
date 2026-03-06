import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      include: ['apps/web/src/**/*.test.ts', 'apps/web/src/**/*.test.tsx']
    }
  },
  {
    test: {
  include: ['api/**/*.test.ts']
    }
  },
  {
    test: {
      include: ['scripts/**/*.test.ts']
    }
  }
]);
