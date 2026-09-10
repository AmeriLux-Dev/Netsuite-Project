import { existsSync } from 'node:fs';
import path from 'node:path';
import { isCommandAvailable, runCommand } from '../util/run.js';

export interface GitInitResult {
    status: 'committed' | 'skipped-existing' | 'skipped-no-git' | 'failed';
    detail?: string;
}

export async function readGitUserName(): Promise<string | undefined> {
    try {
        const result = await runCommand('git', ['config', '--get', 'user.name'], { cwd: process.cwd(), stdio: 'pipe' });
        const name = result.stdout.trim();
        return result.code === 0 && name ? name : undefined;
    } catch {
        return undefined;
    }
}

/** `git init -b main`, stage everything and make the first commit. Never touches an existing repository. */
export async function initializeGitRepository(projectDir: string, commitMessage: string): Promise<GitInitResult> {
    if (existsSync(path.join(projectDir, '.git'))) return { status: 'skipped-existing' };
    if (!(await isCommandAvailable('git'))) return { status: 'skipped-no-git' };

    const steps: string[][] = [
        ['init', '-b', 'main'],
        ['add', '-A'],
        ['commit', '-m', commitMessage, '--quiet'],
    ];
    for (const args of steps) {
        const result = await runCommand('git', args, { cwd: projectDir, stdio: 'pipe' });
        if (result.code !== 0) {
            return { status: 'failed', detail: `git ${args[0]}: ${(result.stderr || result.stdout).trim()}` };
        }
    }
    return { status: 'committed' };
}
