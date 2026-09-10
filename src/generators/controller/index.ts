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
    /** Serve the endpoints from a Suitelet instead of a Restlet. The endpoints are the same either way. */
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

/**
 * Writes `api/src/controllers/<name>/` (the transport file plus one endpoint per method), the SDF
 * object, the shared types, the client API module, and the scripts entry. Never overwrites.
 */
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

    if (options.methods.length === 0) {
        throw new ControllerGenerationError('A controller needs at least one method.');
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
            scriptKind: options.suitelet ? 'suitelet' : 'restlet',
        },
        flags: {
            hasGet: options.methods.includes('get'),
            hasPost: options.methods.includes('post'),
            hasPut: options.methods.includes('put'),
            hasDelete: options.methods.includes('delete'),
            isSuitelet: options.suitelet,
        },
    };

    const projectDir = options.projectDir;
    const controllerDir = path.join(projectDir, 'api', 'src', 'controllers', options.controllerName);
    const netsuitePath = path.join(projectDir, 'common', 'netsuite.ts');

    const netsuiteSource = await fs.readFile(netsuitePath, 'utf8').catch(() => {
        throw new ControllerGenerationError(`${netsuitePath} not found.`);
    });
    const scriptsEntry = renderTemplateString(templates.scriptsEntry, context, 'scriptsEntry');
    const updatedNetsuiteSource = insertScriptsEntry(netsuiteSource, scriptsEntry, options.controllerName);

    const ControllerName = toPascalCase(options.controllerName);
    const plannedFiles: Array<{ filePath: string; content: string }> = [
        { filePath: path.join(controllerDir, `${options.controllerName}Controller.ts`), content: renderTemplateString(templates.controller, context, 'controller') },
        { filePath: path.join(controllerDir, 'endpoints', 'index.ts'), content: renderTemplateString(templates.endpointsIndex, context, 'endpointsIndex') },
        ...options.methods.map((method) => ({
            filePath: path.join(controllerDir, 'endpoints', `${method}${ControllerName}.ts`),
            content: renderTemplateString(templates.endpoint[method], context, `endpoint.${method}`),
        })),
        {
            filePath: path.join(projectDir, 'netsuite', 'Objects', `customscript_${options.config.prefix}_${objectName}.xml`),
            content: renderTemplateString(options.suitelet ? templates.suiteletObject : templates.restletObject, context, 'object'),
        },
        { filePath: path.join(projectDir, 'common', 'types', `${options.controllerName}.ts`), content: renderTemplateString(templates.sharedTypes, context, 'sharedTypes') },
        { filePath: path.join(projectDir, 'client', 'src', 'api', `${options.controllerName}Api.ts`), content: renderTemplateString(templates.clientApi, context, 'clientApi') },
    ];

    if (await fileExists(controllerDir)) {
        throw new ControllerGenerationError(`${controllerDir} already exists; refusing to overwrite.`);
    }
    for (const planned of plannedFiles) {
        if (await fileExists(planned.filePath)) {
            throw new ControllerGenerationError(`${planned.filePath} already exists; refusing to overwrite.`);
        }
    }
    for (const planned of plannedFiles) {
        await fs.mkdir(path.dirname(planned.filePath), { recursive: true });
        await fs.writeFile(planned.filePath, planned.content, 'utf8');
    }
    await fs.writeFile(netsuitePath, updatedNetsuiteSource, 'utf8');

    return {
        writtenFiles: [...plannedFiles.map((planned) => planned.filePath), netsuitePath].map((filePath) => path.relative(projectDir, filePath).replace(/\\/g, '/')),
        scriptId: `customscript_${options.config.prefix}_${objectName}`,
        deployId: `customdeploy_${options.config.prefix}_${objectName}`,
    };
}
