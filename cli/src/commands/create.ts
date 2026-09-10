import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultPrefixForProjectName, toKebabCase, toPascalCase, toTitleCase } from '../naming.js';
import { PROJECT_CONFIG_FILE_NAME } from '../projectConfig.js';
import { isInteractiveTerminal, promptConfirm, promptSelect, promptText, ui } from '../prompts.js';
import { deployProject } from '../steps/deploy.js';
import { initializeGitRepository, readGitUserName } from '../steps/git.js';
import { installDependencies } from '../steps/install.js';
import { listSuiteCloudAuthIds, runSuiteCloudAccountSetup, writeProjectJson } from '../steps/suitecloud.js';
import { DEFAULT_TEMPLATE_REPOSITORY, downloadTemplate } from '../template/fetch.js';
import { renderTemplateDirectory, type RenderContext } from '../template/render.js';
import {
    isProjectType,
    isValidNpmPackageName,
    PROJECT_TYPES,
    validatePrefix,
    validateProjectName,
    type ProjectType,
} from '../validation.js';

export interface CreateCommandOptions {
    directory?: string;
    name?: string;
    prefix?: string;
    author?: string;
    description?: string;
    performanceTracker?: boolean;
    install?: boolean;
    git?: boolean;
    deploy?: boolean;
    authId?: string;
    yes?: boolean;
    ref?: string;
    repo?: string;
    localTemplate?: string;
    projectType?: string;
    /** Option names the user set explicitly (commander's `cli` source), so a default is not mistaken for an answer. */
    explicitOptions?: Set<string>;
}

export interface CreateAnswers {
    projectName: string;
    targetDir: string;
    prefix: string;
    author: string;
    description: string;
    performanceTracker: boolean;
    projectType: ProjectType;
    install: boolean;
    git: boolean;
    deploy: boolean;
}

export class CreateCommandError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CreateCommandError';
    }
}

export const DEFAULT_DESCRIPTION = 'A Suitelet-hosted NetSuite application.';

export async function resolveCreateAnswers(options: CreateCommandOptions): Promise<CreateAnswers> {
    const explicit = options.explicitOptions ?? new Set<string>();
    const interactive = !options.yes && isInteractiveTerminal();
    if (!options.yes && !interactive) {
        ui.warn('Not an interactive terminal; taking defaults for every unanswered prompt (same as --yes).');
    }

    const projectNameFromDirectory = options.directory ? path.basename(path.resolve(options.directory)) : undefined;
    let projectName = options.name ?? projectNameFromDirectory;
    if (projectName === undefined) {
        if (!interactive) throw new CreateCommandError('A project name is required: pass a directory or --name.');
        projectName = await promptText({
            message: 'Project name',
            placeholder: 'MyApp',
            validate: validateProjectName,
        });
    }
    const projectNameProblem = validateProjectName(projectName);
    if (projectNameProblem) throw new CreateCommandError(projectNameProblem);
    if (!isValidNpmPackageName(toKebabCase(projectName))) {
        throw new CreateCommandError(`"${projectName}" does not convert to a valid npm package name.`);
    }

    const targetDir = path.resolve(options.directory ?? projectName);
    if (existsSync(path.join(targetDir, 'package.json'))) {
        throw new CreateCommandError(`${targetDir} already has a package.json; refusing to scaffold over an existing project.`);
    }

    let prefix = options.prefix;
    if (prefix === undefined) {
        const suggested = defaultPrefixForProjectName(projectName);
        prefix = interactive
            ? await promptText({
                message: 'Script id prefix (customscript_<prefix>_…)',
                initialValue: suggested,
                validate: validatePrefix,
            })
            : suggested;
    }
    const prefixProblem = validatePrefix(prefix);
    if (prefixProblem) throw new CreateCommandError(prefixProblem);

    let author = options.author;
    if (author === undefined) {
        const gitUserName = await readGitUserName();
        author = interactive
            ? await promptText({ message: 'Author or team', initialValue: gitUserName ?? '', placeholder: 'Your team' })
            : (gitUserName ?? '');
    }

    let description = options.description;
    if (description === undefined) {
        description = interactive
            ? await promptText({ message: 'One-line description', initialValue: DEFAULT_DESCRIPTION })
            : DEFAULT_DESCRIPTION;
    }

    let performanceTracker = options.performanceTracker;
    if (performanceTracker === undefined || (!explicit.has('performanceTracker') && interactive)) {
        performanceTracker = interactive
            ? await promptConfirm('Enable PerformanceTracker telemetry (netsuite-wrapper spans)?', false)
            : false;
    }

    let projectType: ProjectType = 'react-app';
    if (options.projectType !== undefined) {
        if (!isProjectType(options.projectType)) {
            throw new CreateCommandError(`Unknown project type "${options.projectType}". Known types: ${PROJECT_TYPES.join(', ')}.`);
        }
        projectType = options.projectType;
    } else if (interactive && PROJECT_TYPES.length > 1) {
        projectType = await promptSelect('Project type', PROJECT_TYPES.map((type) => ({ value: type, label: type })), 'react-app');
    }

    const install = explicit.has('install') || !interactive
        ? (options.install ?? true)
        : await promptConfirm('Run npm install now?', true);

    const git = explicit.has('git') || !interactive
        ? (options.git ?? true)
        : await promptConfirm('Initialise a git repository and make the first commit?', true);

    let deploy = false;
    if (install) {
        deploy = explicit.has('deploy') || !interactive
            ? (options.deploy ?? false)
            : await promptConfirm('Deploy to a NetSuite account now? (needs the SuiteCloud CLI and Java 17+)', false);
    } else if (options.deploy) {
        ui.warn('Skipping deploy because dependencies are not being installed.');
    }

    return { projectName, targetDir, prefix, author, description, performanceTracker, projectType, install, git, deploy };
}

export function buildRenderContext(answers: CreateAnswers, templateRef: string, cliVersion: string): RenderContext {
    const appName = toPascalCase(answers.projectName);
    return {
        tokens: {
            appName,
            appNameKebab: toKebabCase(answers.projectName),
            appTitle: toTitleCase(answers.projectName),
            prefix: answers.prefix,
            author: answers.author,
            description: answers.description,
            cliVersion,
            year: String(new Date().getFullYear()),
            templateRef,
            projectType: answers.projectType,
        },
        flags: {
            performanceTracker: answers.performanceTracker,
        },
    };
}

async function acquireTemplate(options: CreateCommandOptions, projectType: ProjectType, cliVersion: string): Promise<{ templateDir: string; templateRef: string; cleanup: () => Promise<void> }> {
    if (options.localTemplate) {
        const templateDir = path.resolve(options.localTemplate);
        if (!existsSync(path.join(templateDir, 'package.json'))) {
            throw new CreateCommandError(`--local-template ${templateDir} does not look like a template (no package.json).`);
        }
        return { templateDir, templateRef: `local:${templateDir.replace(/\\/g, '/')}`, cleanup: async () => undefined };
    }

    const repository = options.repo ?? DEFAULT_TEMPLATE_REPOSITORY;
    const ref = options.ref ?? `v${cliVersion}`;
    const scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-netsuite-project-template-'));
    const templateDir = path.join(scratchDir, projectType);
    ui.step(`Downloading template ${projectType} from ${repository}@${ref}`);
    try {
        await downloadTemplate({ repository, ref, projectType, destinationDir: templateDir });
    } catch (error) {
        await fs.rm(scratchDir, { recursive: true, force: true });
        throw error;
    }
    return { templateDir, templateRef: `${repository}@${ref}`, cleanup: () => fs.rm(scratchDir, { recursive: true, force: true }) };
}

async function chooseDeployAuthId(projectDir: string, requestedAuthId: string | undefined, interactive: boolean): Promise<string | undefined> {
    if (requestedAuthId) {
        await writeProjectJson(projectDir, requestedAuthId);
        return requestedAuthId;
    }
    const entries = await listSuiteCloudAuthIds(projectDir);
    if (!interactive) {
        if (entries.length === 0) return undefined;
        await writeProjectJson(projectDir, entries[0].authId);
        return entries[0].authId;
    }

    const CREATE_NEW = '__create_new__';
    const choice = await promptSelect<string>('Which NetSuite account should this deploy to?', [
        ...entries.map((entry) => ({ value: entry.authId, label: entry.authId, hint: [entry.roleAndCompany, entry.host].filter(Boolean).join(' | ') })),
        { value: CREATE_NEW, label: 'Create a new authentication id…', hint: 'runs suitecloud account:setup' },
    ]);
    if (choice !== CREATE_NEW) {
        await writeProjectJson(projectDir, choice);
        return choice;
    }
    const ok = await runSuiteCloudAccountSetup(projectDir);
    return ok ? 'from-account-setup' : undefined;
}

export async function runCreate(options: CreateCommandOptions, cliVersion: string): Promise<void> {
    ui.intro(`create-netsuite-project v${cliVersion}`);
    const answers = await resolveCreateAnswers(options);
    const appName = toPascalCase(answers.projectName);
    const interactive = !options.yes && isInteractiveTerminal();

    const template = await acquireTemplate(options, answers.projectType, cliVersion);
    try {
        const context = buildRenderContext(answers, template.templateRef, cliVersion);

        if (existsSync(answers.targetDir)) {
            const existing = await fs.readdir(answers.targetDir);
            if (existing.length > 0) {
                ui.info(`${answers.targetDir} already has ${existing.length} entr${existing.length === 1 ? 'y' : 'ies'}; merging the template around ${existing.join(', ')}.`);
            }
        }

        ui.step(`Writing ${appName} to ${answers.targetDir}`);
        const written = await renderTemplateDirectory(template.templateDir, answers.targetDir, context);
        await fs.mkdir(path.join(answers.targetDir, 'netsuite', 'FileCabinet', 'SuiteScripts', appName), { recursive: true });
        ui.success(`Wrote ${written.length} files (${PROJECT_CONFIG_FILE_NAME} records the template and prefix).`);
    } finally {
        await template.cleanup();
    }

    let installed = false;
    if (answers.install) {
        ui.step('Installing dependencies (npm install)');
        const result = await installDependencies(answers.targetDir);
        installed = result.ok;
        if (!result.ok) ui.warn(`npm install failed. Run \`${result.manualCommand}\` in ${answers.targetDir} and then \`npm run deploy\`.`);
    }

    if (answers.git) {
        const result = await initializeGitRepository(answers.targetDir, `chore: scaffold ${appName} with create-netsuite-project ${cliVersion}`);
        if (result.status === 'committed') ui.success('Initialised git repository with the first commit.');
        else if (result.status === 'skipped-existing') ui.info('Existing git repository found; left as is.');
        else if (result.status === 'skipped-no-git') ui.warn('git is not installed; skipped repository setup.');
        else ui.warn(`git setup failed: ${result.detail}`);
    }

    let deployed = false;
    if (answers.deploy && installed) {
        ui.step('Deploying to NetSuite');
        const authId = await chooseDeployAuthId(answers.targetDir, options.authId, interactive);
        if (!authId) {
            ui.warn('No SuiteCloud authentication id available. Run `npx suitecloud account:setup` in the project, then `npm run deploy`.');
        } else {
            const result = await deployProject(answers.targetDir);
            deployed = result.ok;
            if (!result.ok) {
                if (result.looksLikeAuthFailure) {
                    ui.warn('Deployment failed with what looks like an authentication problem. Run `npx suitecloud account:setup` in the project, then `npm run deploy`.');
                } else {
                    ui.warn(`Deployment failed at ${result.failedStage}. Fix the errors above and run \`npm run deploy\`.`);
                }
            }
        }
    }

    const relativeDir = path.relative(process.cwd(), answers.targetDir) || '.';
    const displayDir = relativeDir.startsWith('..') ? answers.targetDir : relativeDir;
    const nextSteps = [
        `cd ${displayDir}`,
        ...(installed ? [] : ['npm install']),
        'cp client/.env.example client/.env   # then fill in the sandbox OAuth 2.0 values',
        'npm run dev                          # Vite + local restlet proxy',
        ...(deployed ? [] : ['npm run deploy                       # builds, then suitecloud project:deploy']),
        `Open the Suitelet in NetSuite: Customization › Scripting › Scripts › "${toTitleCase(answers.projectName)} Home"`,
    ];
    ui.note(nextSteps.join('\n'), 'Next steps');
    ui.outro(`${appName} is ready.`);
}
