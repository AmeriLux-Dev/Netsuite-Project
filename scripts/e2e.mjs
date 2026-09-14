#!/usr/bin/env node
/**
 * Builds the CLI, then runs the template repository's end-to-end check against that build.
 * The check itself lives in netsuite-project-templates (scripts/e2e.mjs) because it asserts what
 * the template produces; this wrapper only locates the checkout and hands over.
 *
 *   node scripts/e2e.mjs            # template repository expected at ../netsuite-project-templates
 *   node scripts/e2e.mjs --keep     # every argument is passed through to the template check
 *   NETSUITE_PROJECT_TEMPLATES_DIR=<path> node scripts/e2e.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const templatesRepositoryDir = path.resolve(
    process.env.NETSUITE_PROJECT_TEMPLATES_DIR ?? path.join(repoRoot, '..', 'netsuite-project-templates'),
);
const templatesEndToEndScript = path.join(templatesRepositoryDir, 'scripts', 'e2e.mjs');

if (!existsSync(templatesEndToEndScript)) {
    console.error([
        `Template repository not found at ${templatesRepositoryDir}.`,
        `Clone https://github.com/${packageJson.templateSource.repository} next to this checkout,`,
        'or set NETSUITE_PROJECT_TEMPLATES_DIR to a checkout.',
    ].join('\n'));
    process.exit(1);
}

function run(command, args, cwd, useShell) {
    console.log(`\n> ${command} ${args.join(' ')}   (in ${cwd})`);
    const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: useShell });
    if (result.status !== 0) {
        console.error(`\nFAILED: ${command} ${args.join(' ')} (exit ${result.status})`);
        process.exit(result.status ?? 1);
    }
}

function describeTemplatesCheckout() {
    const described = spawnSync('git', ['-C', templatesRepositoryDir, 'describe', '--tags', '--always', '--dirty'], { encoding: 'utf8' });
    return described.status === 0 ? described.stdout.trim() : 'not a git checkout';
}

console.log(`Template repository: ${templatesRepositoryDir} (${describeTemplatesCheckout()})`);
console.log(`Default template ref: ${packageJson.templateSource.repository}@${packageJson.templateSource.ref}`);

// npm is a .cmd shim on Windows and needs a shell; node does not.
run('npm', ['run', 'build'], repoRoot, isWindows);
run('node', [templatesEndToEndScript, '--cli', repoRoot, ...process.argv.slice(2)], templatesRepositoryDir, false);
