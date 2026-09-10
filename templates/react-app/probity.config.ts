import { basename } from 'node:path';
import {
    defineConfig,
    enforceTdd,
    forbidCommandPattern,
    forbidContentPattern,
    requireCommand,
    type Rule,
} from '@nizos/probity';

/*
 * Guardrails for AI coding agents working in this repository (Claude Code, Codex, Copilot CLI).
 * Wired through the PreToolUse hook in .claude/settings.json. See CLAUDE.md for the rules in prose.
 *
 * Hard rules block an action; advisory rules pass with feedback. Keep advisory rules rare, or the
 * agent learns to ignore every warning. Anything needing judgement belongs in enforceTdd's
 * instructions, not in a regex.
 */

const toPosixPath = (filePath: string) => filePath.replace(/\\/g, '/');

/* Blocks every write in the block it is scoped to. */
const forbidAnyWrite = (reason: string): Rule => (action) => {
    if (action.kind !== 'write') return { kind: 'pass' };
    return { kind: 'violation', reason };
};

/* Tests belong in __tests__/, never beside the source they cover. */
const forbidColocatedTests: Rule = (action) => {
    if (action.kind !== 'write') return { kind: 'pass' };
    const filePath = toPosixPath(action.path);
    if (/(^|\/)__tests__\//.test(filePath)) return { kind: 'pass' };
    if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(basename(filePath))) return { kind: 'pass' };
    return {
        kind: 'violation',
        reason: 'Tests live under a __tests__/ folder (api/__tests__, client/__tests__), never next to source files.',
    };
};

const warnIfContent = (match: RegExp, message: string): Rule => (action) => {
    if (action.kind !== 'write') return { kind: 'pass' };
    if (!match.test(action.content)) return { kind: 'pass' };
    return {
        kind: 'pass',
        reason: `Advisory: ${message} If intentional, say why in your summary; do not stop work to ask.`,
    };
};

const warnWeakAssertions = warnIfContent(
    /toBeTruthy\(\)|toBe\(true\)/,
    'Weak assertion (toBeTruthy / toBe(true)). Prefer a precise expectation on the actual value.',
);

const warnTypeEscapes = warnIfContent(
    /\bas\s+any\b|:\s*any\b|@ts-ignore|@ts-nocheck/,
    'Type-safety escape hatch (any / @ts-ignore). Fix the underlying type instead.',
);

/* Components are thin shells; behaviour lives in .ts hooks, services and domain functions, which stay enforced. */
const enforceTddExceptComponents = (options: Parameters<typeof enforceTdd>[0]): Rule => {
    const rule = enforceTdd(options);
    return async (action, context) => {
        if (action.kind === 'write' && /\.tsx$/.test(action.path)) return { kind: 'pass' };
        return rule(action, context);
    };
};

export default defineConfig({
    rules: [
        /* Command safety */
        forbidCommandPattern({
            match: /\brm\s+-(rf|fr)\b/,
            reason: 'Avoid recursive force deletes. Delete specific paths deliberately.',
        }),
        forbidCommandPattern({
            match: /Remove-Item\b(?=[^\n]*-Recurse)(?=[^\n]*-Force)/i,
            reason: 'Avoid recursive force deletes. Delete specific paths deliberately.',
        }),
        forbidCommandPattern({
            match: /git\s+commit\b[^\n]*--no-verify/,
            reason: 'Do not bypass git hooks.',
        }),
        forbidCommandPattern({
            match: /git\s+push\s+--force(?!-with-lease)\b/,
            reason: 'Use --force-with-lease.',
        }),

        /* Verification before commit and before anything reaches a NetSuite account */
        requireCommand({
            before: { kind: 'command', match: /git\s+commit\b/ },
            command: /(npm|pnpm|yarn|bun)(\s+run)?\s+test\b|\bvitest\b/,
            after: { kind: 'write' },
            reason: 'Run npm test before committing.',
        }),
        requireCommand({
            before: { kind: 'command', match: /git\s+commit\b/ },
            command: /(npm|pnpm|yarn|bun)\s+run\s+(build|typecheck)\b|\btsc\b/,
            after: { kind: 'write' },
            reason: 'Run npm run typecheck (or build) before committing.',
        }),
        requireCommand({
            before: { kind: 'command', match: /npm\s+run\s+deploy\b|suitecloud\s+(project:deploy|file:upload)\b/ },
            command: /(npm|pnpm|yarn|bun)(\s+run)?\s+test\b|\bvitest\b/,
            after: { kind: 'write' },
            reason: 'Run npm test before deploying to NetSuite, and only deploy when the person asked for it.',
        }),

        /* Generated and account-specific files are never written by an agent */
        {
            files: ['netsuite/FileCabinet/**', 'api/src/models/generated/**', 'client/src/routeTree.gen.ts'],
            rules: [forbidAnyWrite('Generated output. Change the source (models, routes, bundles) and run npm run generate or npm run build instead.')],
        },
        {
            files: ['project.json', 'client/.env', '**/*.pem', '**/*.p12', '**/*.key', '**/*.pfx'],
            rules: [forbidAnyWrite('Account selection and secrets are entered by a person, never written by the agent. Update .env.example if a new variable is needed.')],
        },

        /* Source code */
        {
            files: ['common/**'],
            rules: [
                forbidContentPattern({
                    match: /from\s+['"]N\//,
                    reason: 'common/ is bundled into the client too; it must not import N/* modules.',
                }),
            ],
        },
        {
            files: ['api/src/**', 'client/src/**', 'common/**'],
            rules: [
                forbidColocatedTests,
                forbidContentPattern({
                    match: /VITE_[A-Z0-9_]*(ACCOUNT|CLIENT_ID|CERTIFICATE|KEY|SECRET|TOKEN)/,
                    reason: 'Vite inlines VITE_-prefixed variables into the uploaded bundle. Account data stays in client/.env, read only by server.ts.',
                }),
                warnTypeEscapes,
            ],
        },
        {
            files: ['api/src/**', 'client/src/**', '!api/src/models/**'],
            rules: [
                forbidContentPattern({
                    match: /['"`](customscript|customdeploy|customrecord|customlist|custentity|custbody|custitem|custrecord)_[a-z0-9_]+['"`]/,
                    reason: 'NetSuite identifiers live in common/netsuite.ts (records, fields, scripts); import them from there.',
                }),
            ],
        },

        /* Test-first for the pure logic the tests are designed around: domain functions, the restlet primitive, client API modules and hooks. */
        {
            files: ['api/src/domain/**', 'api/src/lib/**', 'client/src/api/**', 'client/src/features/**'],
            rules: [
                enforceTddExceptComponents({
                    instructions: (defaults) => `${defaults}

### Project standards

- Behaviour change (new or changed outputs, validation, side-effects, error handling): write or extend a test in the matching __tests__/ folder, see it fail, then implement the minimum.
- Refactor with unchanged behaviour, configuration, documentation, generated files and .gitignore changes need no new test.
- Test observable behaviour through the public surface: inputs to outputs, calls made to the repository context or callEndpoint, envelope status and error. Never assert on DOM structure, CSS classes or internal state.
- Domain functions take the repository context as an argument; tests pass a fake that records the specifications applied to it.
- Prefer extending an existing test file over a duplicate; prefer the lowest level that proves the behaviour.`,
                }),
            ],
        },

        /* Test files */
        {
            files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
            rules: [
                forbidContentPattern({
                    match: /\b(describe|it|test)\.(only|skip)\s*\(/,
                    reason: 'No focused or skipped tests.',
                }),
                warnWeakAssertions,
            ],
        },
    ],
});
