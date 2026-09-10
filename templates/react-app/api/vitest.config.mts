import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const stubsDir = path.join(apiDir, 'test', 'stubs', 'N');

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify('0.0.0-test'),
        __BUILD_ID__: JSON.stringify('test'),
    },
    resolve: {
        alias: [
            // N/* is only real inside NetSuite; tests get vi.fn shells.
            { find: /^N\/(.*)$/, replacement: `${stubsDir.replace(/\\/g, '/')}/$1.ts` },
            // The wrapper's per-module entry points resolve to the same stubs.
            { find: /^@amerilux\/netsuite-wrapper\/(record|query|search|log|https|runtime|task|url)$/, replacement: `${stubsDir.replace(/\\/g, '/')}/$1.ts` },
            { find: /^common\/(.*)$/, replacement: `${path.resolve(apiDir, '../common').replace(/\\/g, '/')}/$1` },
        ],
    },
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
        server: {
            deps: {
                // Both packages lazily require('N/query') etc. at call time; inlining them routes those
                // requires through the alias above instead of Node's resolver.
                inline: ['@amerilux/netsuite-repository', '@amerilux/netsuite-wrapper'],
            },
        },
    },
});
