import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    clean: true,
    minify: false,
    sourcemap: false,
    splitting: false,
    banner: { js: '#!/usr/bin/env node' },
    define: { __CLI_VERSION__: JSON.stringify(packageJson.version) },
});
