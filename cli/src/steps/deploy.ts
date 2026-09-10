import { runCommand } from '../util/run.js';
import { resolveSuiteCloudBinary } from './suitecloud.js';

export type DeployStage = 'build' | 'adddependencies' | 'deploy';

export interface DeployResult {
    ok: boolean;
    failedStage?: DeployStage;
    /** True when the failure output looks like an authentication problem. */
    looksLikeAuthFailure?: boolean;
    output?: string;
}

const AUTH_FAILURE_PATTERN = /auth|credential|login|token|unauthori[sz]ed/i;

/** build → project:adddependencies → project:deploy, streaming the SuiteCloud output to the terminal. */
export async function deployProject(projectDir: string): Promise<DeployResult> {
    const build = await runCommand('npm', ['run', 'build'], { cwd: projectDir, stdio: 'inherit' });
    if (build.code !== 0) return { ok: false, failedStage: 'build' };

    const suitecloud = resolveSuiteCloudBinary(projectDir);

    const stages: Array<{ name: DeployStage; args: string[] }> = [
        { name: 'adddependencies', args: ['project:adddependencies'] },
        { name: 'deploy', args: ['project:deploy'] },
    ];
    for (const stage of stages) {
        const result = await runCommand(suitecloud, stage.args, { cwd: projectDir, stdio: 'pipe' });
        const output = `${result.stdout}${result.stderr}`;
        process.stdout.write(output);
        if (result.code !== 0) {
            return { ok: false, failedStage: stage.name, looksLikeAuthFailure: AUTH_FAILURE_PATTERN.test(output), output };
        }
    }
    return { ok: true };
}
