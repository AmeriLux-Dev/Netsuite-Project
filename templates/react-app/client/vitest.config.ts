import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const clientDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify('0.0.0-test'),
        __BUILD_ID__: JSON.stringify('test'),
    },
    resolve: {
        alias: {
            '@': path.resolve(clientDir, 'src'),
            common: path.resolve(clientDir, '../common'),
        },
    },
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
    },
});
