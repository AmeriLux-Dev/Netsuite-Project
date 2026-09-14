#!/usr/bin/env node
/**
 * Fails when anything account-specific or private leaks into the public repository.
 *
 * The rules are generic on purpose: this file is public too, so it must never spell out the
 * real account id, auth ids or script prefixes it guards against. Maintainers can add exact
 * strings in a gitignored `.private-refs.local` (one per line) or in the PRIVATE_REF_PATTERNS
 * environment variable (pipe-separated regular expressions) for CI.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage']);
const SKIPPED_FILES = new Set(['package-lock.json', '.private-refs.local']);
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.md', '.xml', '.yml', '.yaml', '.css', '.html', '.txt', '.example', '']);

/** The only custom-object prefixes the template and its tests may use. */
const ALLOWED_CUSTOM_ID_PREFIXES = ['{{prefix}}', 'demo', '<prefix>', 'test', 'ptrk'];
const DOCUMENTED_PLACEHOLDER_ACCOUNT_ID = '1234567';

const RULES = [
    {
        name: 'NetSuite account id (7 digits next to a NetSuite host or sandbox suffix)',
        pattern: /\b\d{7}(?:[-_]sb\d+)?(?:\.(?:app|restlets\.api|suitetalk\.api)\.netsuite\.com|\b)/i,
        allow: [DOCUMENTED_PLACEHOLDER_ACCOUNT_ID],
        // Only lines that also look NetSuite-related, so version numbers and timestamps do not trip it.
        requires: /netsuite|account|sb\d|suitetalk|restlets/i,
    },
    {
        name: `custom-object id with a prefix other than ${ALLOWED_CUSTOM_ID_PREFIXES.join(', ')}`,
        // custpage_ ids are form-local field names, not account objects, so they are not checked.
        pattern: new RegExp(`\\bcust(?:om)?(?:script|deploy|record|list|entity|body|item)_(?!(?:${ALLOWED_CUSTOM_ID_PREFIXES.map(escapeRegExp).join('|')})(?:_|\\b))[A-Za-z0-9]+`, 'i'),
    },
    { name: 'SuiteCloud auth selection (project.json content)', pattern: /"defaultAuthId"\s*:\s*"(?!<)[^"]+"/ },
    { name: 'e-mail address that is not a documented placeholder', pattern: /[A-Za-z0-9._%+-]+@(?!example\.com|acme\.example|users\.noreply\.github\.com)[A-Za-z0-9.-]+\.[a-z]{2,}/, allow: ['@amerilux/netsuite-'] },
    { name: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: 'token-looking string', pattern: /\b(?:ghp_[A-Za-z0-9]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,})\b/ },
    { name: 'local machine path', pattern: /(?:[A-Za-z]:\\|\/home\/|\/Users\/)(?!temp\b)[A-Za-z0-9._-]+/i, allow: ['C:\\\\temp', 'C:\\temp'] },
    // Four octets, so semver ranges such as ^10.10.0 do not match.
    { name: 'local IPv4 address', pattern: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/ },
    {
        name: 'company name outside the public packages and repository',
        pattern: /amerilux/i,
        allow: ['@amerilux/*', 'github.com/AmeriLux-Dev', 'AmeriLux-Dev/'],
    },
    ...loadLocalRules(),
];

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadLocalRules() {
    const rules = [];
    const localFile = path.join(repoRoot, '.private-refs.local');
    if (existsSync(localFile)) {
        for (const line of readFileSync(localFile, 'utf8').split(/\r?\n/)) {
            const literal = line.trim();
            if (literal && !literal.startsWith('#')) rules.push({ name: 'listed in .private-refs.local', pattern: new RegExp(escapeRegExp(literal), 'i') });
        }
    }
    for (const source of (process.env.PRIVATE_REF_PATTERNS ?? '').split('|').map((entry) => entry.trim()).filter(Boolean)) {
        rules.push({ name: 'listed in PRIVATE_REF_PATTERNS', pattern: new RegExp(source, 'i') });
    }
    return rules;
}

function* walk(directory) {
    for (const entry of readdirSync(directory)) {
        const fullPath = path.join(directory, entry);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
            if (!SKIPPED_DIRECTORIES.has(entry)) yield* walk(fullPath);
        } else if (!SKIPPED_FILES.has(entry) && TEXT_EXTENSIONS.has(path.extname(entry))) {
            yield fullPath;
        }
    }
}

const selfPath = fileURLToPath(import.meta.url);
const problems = [];
for (const filePath of walk(repoRoot)) {
    if (filePath === selfPath) continue;
    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
        for (const rule of RULES) {
            if (!rule.pattern.test(line)) continue;
            if (rule.requires && !rule.requires.test(line)) continue;
            if (rule.allow && rule.allow.some((allowed) => line.includes(allowed))) continue;
            problems.push(`${path.relative(repoRoot, filePath)}:${index + 1}: ${rule.name}`);
        }
    });
}

if (problems.length > 0) {
    console.error(`Private references found:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
    process.exit(1);
}
console.log(`No private references found (${RULES.length} rules).`);
