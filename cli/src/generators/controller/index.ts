import { promises as fs } from 'node:fs';
import path from 'node:path';
import { toPascalCase, toSnakeCase, toTitleCase } from '../../naming.js';
import type { NetSuiteProjectConfig } from '../../projectConfig.js';
import { renderTemplateString, type RenderContext } from '../../template/render.js';
import { validateControllerName, validateObjectName } from '../../validation.js';
import { CONTROLLER_TEMPLATES } from './templates.js';

export const HTTP_METHODS = ['get', 'post', 'put', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const SCRIPTS_MARKER = '// @netsuite-project:scripts';

export interface GenerateControllerOptions {
    projectDir: string;
    config: NetSuiteProjectConfig;
    controllerName: string;
    methods: HttpMethod[];
    suitelet: boolean;
}

export interface GeneratedController {
    writtenFiles: string[];
    scriptId: string;
    deployId: string;
}

export class ControllerGenerationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ControllerGenerationError';
    }
}

export function parseMethods(raw: string | undefined): HttpMethod[] {
    if (!raw) return ['get'];
    const methods = raw.split(',').map((method) => method.trim().toLowerCase()).filter(Boolean);
    const unknown = methods.filter((method) => !(HTTP_METHODS as readonly string[]).includes(method));
    if (unknown.length > 0) {
        throw new ControllerGenerationError(`Unknown method(s): ${unknown.join(', ')}. Use any of ${HTTP_METHODS.join(', ')}.`);
    }
    return HTTP_METHODS.filter((method) => methods.includes(method));
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function writeNewFile(filePath: string, content: string): Promise<void> {
    if (await fileExists(filePath)) {
        throw new ControllerGenerationError(`${filePath} already exists; refusing to overwrite.`);
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
}

export function insertScriptsEntry(netsuiteSource: string, entry: string, controllerName: string): string {
    if (new RegExp(`^\\s*${controllerName}:\\s*\\{`, 'm').test(netsuiteSource)) {
        throw new ControllerGenerationError(`common/netsuite.ts already has a scripts.${controllerName} entry.`);
    }
    const markerIndex = netsuiteSource.indexOf(SCRIPTS_MARKER);
    if (markerIndex === -1) {
        throw new ControllerGenerationError(`common/netsuite.ts has no "${SCRIPTS_MARKER}" marker; add it inside the scripts object.`);
    }
    const lineStart = netsuiteSource.lastIndexOf('\n', markerIndex) + 1;
    return `${netsuiteSource.slice(0, lineStart)}${entry}${netsuiteSource.slice(lineStart)}`;
}

/** Writes the controller, its SDF object, the shared types, the client API module, and the scripts entry. Never overwrites. */
export async function generateController(options: GenerateControllerOptions): Promise<GeneratedController> {
    const templates = CONTROLLER_TEMPLATES[options.config.template];
    if (!templates) {
        throw new ControllerGenerationError(`No controller generator for project type "${options.config.template}".`);
    }

    const nameProblem = validateControllerName(options.controllerName);
    if (nameProblem) throw new ControllerGenerationError(nameProblem);

    const objectName = toSnakeCase(options.controllerName);
    const objectProblem = validateObjectName(objectName, options.config.prefix);
    if (objectProblem) throw new ControllerGenerationError(objectProblem);

    if (!options.suitelet && options.methods.length === 0) {
        throw new ControllerGenerationError('A restlet needs at least one method.');
    }

    const context: RenderContext = {
        tokens: {
            controllerName: options.controllerName,
            ControllerName: toPascalCase(options.controllerName),
            controllerTitle: toTitleCase(options.controllerName),
            objectName,
            prefix: options.config.prefix,
            appName: options.config.appName,
            appTitle: toTitleCase(options.config.appName),
        },
        flags: {
            hasGet: options.methods.includes('get'),
            hasPost: options.methods.includes('post'),
            hasPut: options.methods.includes('put'),
            hasDelete: options.methods.includes('delete'),
        },
    };

    const projectDir = options.projectDir;
    const controllerPath = path.join(projectDir, 'api', 'src', 'controllers', `${options.controllerName}Controller.ts`);
    const objectPath = path.join(projectDir, 'netsuite', 'Objects', `customscript_${options.config.prefix}_${objectName}.xml`);
    const typesPath = path.join(projectDir, 'common', 'types', `${options.controllerName}.ts`);
    const clientApiPath = path.join(projectDir, 'client', 'src', 'api', `${options.controllerName}Api.ts`);
    const netsuitePath = path.join(projectDir, 'common', 'netsuite.ts');

    const netsuiteSource = await fs.readFile(netsuitePath, 'utf8').catch(() => {
        throw new ControllerGenerationError(`${netsuitePath} not found.`);
    });
    const scriptsEntry = renderTemplateString(templates.scriptsEntry, context, 'scriptsEntry');
    const updatedNetsuiteSource = insertScriptsEntry(netsuiteSource, scriptsEntry, options.controllerName);

    const plannedFiles: Array<{ filePath: string; content: string }> = options.suitelet
        ? [
            { filePath: controllerPath, content: renderTemplateString(templates.suiteletController, context, 'suiteletController') },
            { filePath: objectPath, content: renderTemplateString(templates.suiteletObject, context, 'suiteletObject') },
        ]
        : [
            { filePath: controllerPath, content: renderTemplateString(templates.restletController, context, 'restletController') },
            { filePath: objectPath, content: renderTemplateString(templates.restletObject, context, 'restletObject') },
            { filePath: typesPath, content: renderTemplateString(templates.sharedTypes, context, 'sharedTypes') },
            { filePath: clientApiPath, content: renderTemplateString(templates.clientApi, context, 'clientApi') },
        ];

    for (const planned of plannedFiles) {
        if (await fileExists(planned.filePath)) {
            throw new ControllerGenerationError(`${planned.filePath} already exists; refusing to overwrite.`);
        }
    }
    for (const planned of plannedFiles) {
        await writeNewFile(planned.filePath, planned.content);
    }
    await fs.writeFile(netsuitePath, updatedNetsuiteSource, 'utf8');

    return {
        writtenFiles: [...plannedFiles.map((planned) => planned.filePath), netsuitePath].map((filePath) => path.relative(projectDir, filePath).replace(/\\/g, '/')),
        scriptId: `customscript_${options.config.prefix}_${objectName}`,
        deployId: `customdeploy_${options.config.prefix}_${objectName}`,
    };
}
