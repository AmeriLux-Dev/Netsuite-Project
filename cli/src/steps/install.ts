import { runCommand } from '../util/run.js';

export interface InstallResult {
    ok: boolean;
    manualCommand: string;
}

/** `npm install` with output streamed to the terminal; a failure is reported, never thrown. */
export async function installDependencies(projectDir: string): Promise<InstallResult> {
    const result = await runCommand('npm', ['install'], { cwd: projectDir, stdio: 'inherit' });
    return { ok: result.code === 0, manualCommand: 'npm install' };
}
