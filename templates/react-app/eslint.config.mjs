import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Deliberately minimal: the recommended rule sets and the React hooks rules.
// Tighten (complexity budgets, import ordering, naming) once the team agrees on a rule set.
export default defineConfig([
    globalIgnores([
        '**/node_modules/**',
        'netsuite/FileCabinet/**',
        'api/src/models/generated/**',
        'client/src/routeTree.gen.ts',
        '**/dist/**',
        '**/coverage/**',
    ]),
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['**/*.{js,cjs,mjs}', 'client/server.ts', 'scripts/**'],
        languageOptions: { globals: { ...globals.node } },
    },
    {
        // Build configuration is CommonJS on purpose: webpack and the SuiteCloud CLI load it with require().
        files: ['**/*.{js,cjs}'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        files: ['client/src/**/*.{ts,tsx}'],
        languageOptions: { globals: { ...globals.browser } },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        files: ['api/src/**/*.ts'],
        // SuiteScript's own globals plus the build-time constants webpack defines.
        languageOptions: { globals: { define: 'readonly', __APP_VERSION__: 'readonly', __BUILD_ID__: 'readonly' } },
    },
]);
