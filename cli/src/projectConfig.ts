import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isProjectType, type ProjectType } from './validation.js';

/** `.netsuite-project.json`: committed by the scaffold, read by `add controller`. */
export const PROJECT_CONFIG_FILE_NAME = '.netsuite-project.json';

export interface NetSuiteProjectConfig {
    template: ProjectType;
    templateRef: string;
    appName: string;
    prefix: string;
    cliVersion: string;
}

export class ProjectConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProjectConfigError';
    }
}

/** Walks up from `startDir` to the nearest directory holding the config file. */
export async function findProjectRoot(startDir: string): Promise<string | undefined> {
    let current = path.resolve(startDir);
    for (;;) {
        try {
            await fs.access(path.join(current, PROJECT_CONFIG_FILE_NAME));
            return current;
        } catch {
            const parent = path.dirname(current);
            if (parent === current) return undefined;
            current = parent;
        }
    }
}

export async function readProjectConfig(projectDir: string): Promise<NetSuiteProjectConfig> {
    const filePath = path.join(projectDir, PROJECT_CONFIG_FILE_NAME);
    let raw: string;
    try {
        raw = await fs.readFile(filePath, 'utf8');
    } catch {
        throw new ProjectConfigError(`${PROJECT_CONFIG_FILE_NAME} not found in ${projectDir}. Run this inside a project created by create-netsuite-project.`);
    }
    let parsed: Partial<NetSuiteProjectConfig>;
    try {
        parsed = JSON.parse(raw) as Partial<NetSuiteProjectConfig>;
    } catch (error) {
        throw new ProjectConfigError(`${filePath} is not valid JSON: ${(error as Error).message}`);
    }
    if (typeof parsed.template !== 'string' || !isProjectType(parsed.template)) {
        throw new ProjectConfigError(`${filePath}: "template" must name a known project type.`);
    }
    if (typeof parsed.appName !== 'string' || typeof parsed.prefix !== 'string') {
        throw new ProjectConfigError(`${filePath}: "appName" and "prefix" are required.`);
    }
    return {
        template: parsed.template,
        templateRef: typeof parsed.templateRef === 'string' ? parsed.templateRef : 'unknown',
        appName: parsed.appName,
        prefix: parsed.prefix,
        cliVersion: typeof parsed.cliVersion === 'string' ? parsed.cliVersion : 'unknown',
    };
}
