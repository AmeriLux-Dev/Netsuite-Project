#!/usr/bin/env node
/**
 * Deploy {{appTitle}} to the NetSuite account selected in project.json.
 *
 *   npm run deploy          build both bundles, then `suitecloud project:adddependencies` and `project:deploy`
 *                           (uploads File Cabinet files and creates/updates the script records and deployments)
 *   npm run deploy:files    build, then upload only the File Cabinet files (`suitecloud file:upload`) in batches
 *                           of 10; the fast path after a client-only change
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileCabinetRoot = path.join(projectRoot, 'netsuite', 'FileCabinet', 'SuiteScripts');
const filesOnly = process.argv.includes('--files-only');
const isWindows = process.platform === 'win32';

function run(command, args) {
    console.log(`\n> ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, { cwd: projectRoot, stdio: 'inherit', shell: isWindows });
    if (result.status !== 0) {
        console.error(`\n${command} ${args[0] ?? ''} failed (exit ${result.status}).`);
        process.exit(result.status ?? 1);
    }
}

function resolveSuiteCloudBinary() {
    const binary = path.join(projectRoot, 'node_modules', '.bin', isWindows ? 'suitecloud.cmd' : 'suitecloud');
    if (!existsSync(binary)) {
        console.error('SuiteCloud CLI not found; run npm install first.');
        process.exit(1);
    }
    return binary;
}

function listFileCabinetPaths(directory, relativePrefix = '') {
    const paths = [];
    for (const entry of readdirSync(directory)) {
        // .attributes holds SDF metadata; other dotfiles (.gitkeep, .DS_Store) are never uploaded.
        if (entry.startsWith('.')) continue;
        const fullPath = path.join(directory, entry);
        const relativePath = relativePrefix ? `${relativePrefix}/${entry}` : entry;
        if (statSync(fullPath).isDirectory()) {
            paths.push(...listFileCabinetPaths(fullPath, relativePath));
        } else {
            paths.push(`/SuiteScripts/${relativePath}`);
        }
    }
    return paths;
}

if (!existsSync(path.join(projectRoot, 'project.json'))) {
    console.error('No project.json (SuiteCloud auth id) found. Run `npx suitecloud account:setup` first.');
    process.exit(1);
}

run('npm', ['run', 'build']);

const suitecloud = resolveSuiteCloudBinary();

if (filesOnly) {
    const files = listFileCabinetPaths(fileCabinetRoot);
    if (files.length === 0) {
        console.error('Nothing to upload under netsuite/FileCabinet/SuiteScripts.');
        process.exit(1);
    }
    const batchSize = 10;
    for (let start = 0; start < files.length; start += batchSize) {
        const batch = files.slice(start, start + batchSize);
        console.log(`Uploading ${start + 1}-${start + batch.length} of ${files.length}`);
        run(suitecloud, ['file:upload', '--paths', ...batch]);
    }
} else {
    run(suitecloud, ['project:adddependencies']);
    run(suitecloud, ['project:deploy']);
}

console.log('\nDeploy finished.');
