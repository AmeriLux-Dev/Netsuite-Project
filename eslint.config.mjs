import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    globalIgnores(['dist/**', 'node_modules/**']),
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: { ...globals.node, __CLI_VERSION__: 'readonly', __TEMPLATE_REPOSITORY__: 'readonly', __TEMPLATE_REF__: 'readonly' },
        },
    },
]);
