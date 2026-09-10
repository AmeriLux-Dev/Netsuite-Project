import { promises as fs } from 'node:fs';
import path from 'node:path';
import { runCommand, resolveLocalBinary } from '../util/run.js';

/**
 * The SuiteCloud CLI pieces the scaffold touches: listing saved authentication ids,
 * running the interactive account setup, and writing the gitignored project.json.
 */

export interface SuiteCloudAuthEntry {
    authId: string;
    roleAndCompany: string;
    host?: string;
}

/**
 * `suitecloud account:manageauth --list` prints one `authId | Role @ Company | host` line per
 * saved id; the first line may be prefixed with ANSI clear codes and the host column is optional.
 */
export function parseManageAuthList(output: string): SuiteCloudAuthEntry[] {
    const entries: SuiteCloudAuthEntry[] = [];
    for (const rawLine of output.split(/\r?\n/)) {
        // eslint-disable-next-line no-control-regex
        const line = rawLine.replace(/\[[0-9;]*[A-Za-z]/g, '').trim();
        if (!line.includes('|')) continue;
        const [authId, roleAndCompany, host] = line.split('|').map((part) => part.trim());
        if (!authId || !/^[A-Za-z0-9_-]+$/.test(authId)) continue;
        entries.push({ authId, roleAndCompany: roleAndCompany ?? '', host: host || undefined });
    }
    return entries;
}

export class SuiteCloudNotInstalledError extends Error {
    constructor(projectDir: string) {
        super(`The SuiteCloud CLI is not installed in ${projectDir}. Run npm install first.`);
        this.name = 'SuiteCloudNotInstalledError';
    }
}

export function resolveSuiteCloudBinary(projectDir: string): string {
    const binary = resolveLocalBinary(projectDir, 'suitecloud');
    if (!binary) throw new SuiteCloudNotInstalledError(projectDir);
    return binary;
}

export async function listSuiteCloudAuthIds(projectDir: string): Promise<SuiteCloudAuthEntry[]> {
    const binary = resolveSuiteCloudBinary(projectDir);
    const result = await runCommand(binary, ['account:manageauth', '--list'], { cwd: projectDir, stdio: 'pipe' });
    if (result.code !== 0) return [];
    return parseManageAuthList(`${result.stdout}\n${result.stderr}`);
}

/** Interactive: the CLI prompts for auth id, method and browser login, then writes project.json itself. */
export async function runSuiteCloudAccountSetup(projectDir: string): Promise<boolean> {
    const binary = resolveSuiteCloudBinary(projectDir);
    const result = await runCommand(binary, ['account:setup'], { cwd: projectDir, stdio: 'inherit' });
    return result.code === 0;
}

export async function writeProjectJson(projectDir: string, authId: string): Promise<void> {
    const filePath = path.join(projectDir, 'project.json');
    await fs.writeFile(filePath, `${JSON.stringify({ defaultAuthId: authId }, null, 4)}\n`, 'utf8');
}

export async function readProjectJsonAuthId(projectDir: string): Promise<string | undefined> {
    try {
        const raw = await fs.readFile(path.join(projectDir, 'project.json'), 'utf8');
        const parsed = JSON.parse(raw) as { defaultAuthId?: unknown };
        return typeof parsed.defaultAuthId === 'string' ? parsed.defaultAuthId : undefined;
    } catch {
        return undefined;
    }
}
