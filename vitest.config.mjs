import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/main/services/**/*.ts', 'src/main/infra/**/*.ts', 'src/shared/domain/**/*.ts'],
      exclude: [
        'src/main.ts', 'src/index.html',
        'src/audio-processor.ts',
        'src/shared/types/**'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
});
