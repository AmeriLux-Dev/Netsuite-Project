import { defineConfig } from 'vitest/config';

export default defineConfig({
    define: { __CLI_VERSION__: '"0.0.0-test"' },
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
    },
});
