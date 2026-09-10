import { spawn, type StdioOptions } from 'node:child_process';

export interface RunCommandOptions {
    cwd: string;
    /** `inherit` streams to the terminal (interactive tools), `pipe` captures. */
    stdio?: 'inherit' | 'pipe';
    env?: NodeJS.ProcessEnv;
}

export interface RunCommandResult {
    code: number;
    stdout: string;
    stderr: string;
}

export class CommandFailedError extends Error {
    constructor(readonly command: string, readonly result: RunCommandResult) {
        super(`${command} exited with code ${result.code}${result.stderr ? `\n${result.stderr.trim()}` : ''}`);
        this.name = 'CommandFailedError';
    }
}

const IS_WINDOWS = process.platform === 'win32';

function quoteForShell(argument: string): string {
    if (!IS_WINDOWS || !/[\s"]/.test(argument)) return argument;
    return `"${argument.replace(/"/g, '\\"')}"`;
}

/**
 * Runs a command and resolves with its exit code and captured output. On Windows the
 * command goes through the shell so `npm`, `git` and `.cmd` shims resolve like they do
 * in a terminal. Rejects only when the process cannot be started.
 */
export function runCommand(command: string, args: string[], options: RunCommandOptions): Promise<RunCommandResult> {
    const stdio: StdioOptions = options.stdio === 'pipe' ? ['ignore', 'pipe', 'pipe'] : 'inherit';
    return new Promise((resolve, reject) => {
        const child = IS_WINDOWS
            ? spawn([command, ...args].map(quoteForShell).join(' '), { cwd: options.cwd, stdio, env: options.env ?? process.env, shell: true })
            : spawn(command, args, { cwd: options.cwd, stdio, env: options.env ?? process.env });

        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
}

/** Like runCommand, but throws CommandFailedError on a non-zero exit. */
export async function runCommandOrThrow(command: string, args: string[], options: RunCommandOptions): Promise<RunCommandResult> {
    const result = await runCommand(command, args, options);
    if (result.code !== 0) throw new CommandFailedError([command, ...args].join(' '), result);
    return result;
}

export async function isCommandAvailable(command: string): Promise<boolean> {
    try {
        const result = await runCommand(command, ['--version'], { cwd: process.cwd(), stdio: 'pipe' });
        return result.code === 0;
    } catch {
        return false;
    }
}
