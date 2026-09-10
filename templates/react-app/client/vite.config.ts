import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

const require = createRequire(import.meta.url);
const { readBuildInfo } = require('../scripts/buildInfo.cjs') as { readBuildInfo: (packageJsonPath: string) => { version: string; buildId: string } };

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const buildInfo = readBuildInfo(path.resolve(clientDir, '../package.json'));

export default defineConfig({
    plugins: [
        // File-based routing: every file under src/routes becomes a route and src/routeTree.gen.ts
        // is regenerated on dev and build. Code splitting stays off: the Suitelet loads one file.
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: false,
            routesDirectory: path.resolve(clientDir, 'src/routes'),
            generatedRouteTree: path.resolve(clientDir, 'src/routeTree.gen.ts'),
            quoteStyle: 'single',
            semicolons: true,
        }),
        react(),
        tailwindcss(),
        cssInjectedByJsPlugin(),
    ],
    base: './',
    define: {
        __APP_VERSION__: JSON.stringify(buildInfo.version),
        __BUILD_ID__: JSON.stringify(buildInfo.buildId),
    },
    resolve: {
        alias: {
            '@': path.resolve(clientDir, 'src'),
            common: path.resolve(clientDir, '../common'),
        },
    },
    build: {
        // Only this folder is emptied; the API bundles live in the sibling api/ folder.
        outDir: path.resolve(clientDir, '../netsuite/FileCabinet/SuiteScripts/{{appName}}/client'),
        emptyOutDir: true,
        cssCodeSplit: false,
        rollupOptions: {
            // index.html is for the dev server only; the Suitelet supplies the page.
            input: path.resolve(clientDir, 'src/main.tsx'),
            output: {
                // One self-executing file: the Suitelet loads it with a plain <script> tag.
                format: 'iife',
                entryFileNames: 'app.js',
                assetFileNames: '[name].[ext]',
            },
        },
    },
    server: {
        port: 3000,
        strictPort: true,
        proxy: {
            // server.ts signs and forwards restlet calls to the sandbox.
            '/api': 'http://localhost:4000',
        },
    },
});
