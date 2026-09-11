import { promises as fs } from 'node:fs';
import path from 'node:path';
import { toPascalCase, toSnakeCase, toTitleCase } from '../../naming.js';
import type { NetSuiteProjectConfig } from '../../projectConfig.js';
import { renderTemplateString, type RenderContext } from '../../template/render.js';
import { validateControllerName, validateObjectName } from '../../validation.js';
import { CONTROLLER_TEMPLATES } from './templates.js';

export const HTTP_METHODS = ['get', 'post', 'put', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** One endpoint of the controller: its name (the action, as ASP.NET would call it) and the HTTP method it answers. */
export interface EndpointSpec {
    name: string;
    method: HttpMethod;
}

export const SCRIPTS_MARKER = '// @netsuite-project:scripts';

const ENDPOINT_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;
/** Names that would collide with a file or a wire parameter the generated code already uses. */
const RESERVED_ENDPOINT_NAMES = new Set(['index', 'endpoint']);

export interface GenerateControllerOptions {
    projectDir: string;
    config: NetSuiteProjectConfig;
    controllerName: string;
    endpoints: EndpointSpec[];
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

/** Parses `list:get,byId:get,create:post`. A bare name answers GET; nothing at all means one `list` endpoint. */
export function parseEndpoints(raw: string | undefined): EndpointSpec[] {
    if (!raw || raw.trim() === '') return [{ name: 'list', method: 'get' }];
    const endpoints: EndpointSpec[] = [];
    for (const entry of raw.split(',').map((part) => part.trim()).filter(Boolean)) {
        const [name, methodPart = 'get', ...extra] = entry.split(':').map((part) => part.trim());
        if (extra.length > 0 || !ENDPOINT_NAME_PATTERN.test(name)) {
            throw new ControllerGenerationError(`Endpoint "${entry}" must be a camelCase name, optionally followed by :method (for example byId:get).`);
        }
        if (RESERVED_ENDPOINT_NAMES.has(name)) {
            throw new ControllerGenerationError(`"${name}" cannot be an endpoint name; it is reserved.`);
        }
        const method = methodPart.toLowerCase();
        if (!(HTTP_METHODS as readonly string[]).includes(method)) {
            throw new ControllerGenerationError(`Unknown method "${methodPart}" for endpoint "${name}". Use any of ${HTTP_METHODS.join(', ')}.`);
        }
        if (endpoints.some((endpoint) => endpoint.name === name)) {
            throw new ControllerGenerationError(`Endpoint "${name}" is listed twice.`);
        }
        endpoints.push({ name, method: method as HttpMethod });
    }
    return endpoints;
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

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The template language has no loops, so the per-endpoint lines of the shared files are built here and passed in as tokens. */
function buildEndpointListTokens(ControllerName: string, endpoints: EndpointSpec[]): Record<string, string> {
    const typeName = (endpoint: EndpointSpec) => `${ControllerName}${capitalize(endpoint.name)}`;
    return {
        endpointImports: endpoints.map((endpoint) => `import { ${endpoint.name} } from './${endpoint.name}';`).join('\n'),
        endpointNames: endpoints.map((endpoint) => endpoint.name).join(', '),
        contractEntries: endpoints.map((endpoint) => `    ${endpoint.name}: { method: '${endpoint.method.toUpperCase()}' },`).join('\n'),
        endpointTypeEntries: endpoints.map((endpoint) => `    ${endpoint.name}: { request: ${typeName(endpoint)}Request; response: ${typeName(endpoint)}Response };`).join('\n'),
        sharedTypeDeclarations: endpoints.map((endpoint) => {
            const requestMembers = endpoint.method === 'get' ? '    [parameter: string]: string | undefined;' : '    [field: string]: unknown;';
            return `export interface ${typeName(endpoint)}Request {\n${requestMembers}\n}\n\nexport interface ${typeName(endpoint)}Response {\n    message: string;\n    request: ${typeName(endpoint)}Request;\n}\n`;
        }).join('\n'),
    };
}

/**
 * Writes `api/src/controllers/<name>/` (the transport file plus one file per endpoint), the SDF
 * object, the shared types with the contract, the client API module, and the scripts entry. Never overwrites.
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

    if (options.endpoints.length === 0) {
        throw new ControllerGenerationError('A controller needs at least one endpoint.');
    }

    const ControllerName = toPascalCase(options.controllerName);
    const methods = new Set(options.endpoints.map((endpoint) => endpoint.method));
    const context: RenderContext = {
        tokens: {
            controllerName: options.controllerName,
            ControllerName,
            controllerTitle: toTitleCase(options.controllerName),
            objectName,
            prefix: options.config.prefix,
            appName: options.config.appName,
            appTitle: toTitleCase(options.config.appName),
            scriptKind: options.suitelet ? 'suitelet' : 'restlet',
            ...buildEndpointListTokens(ControllerName, options.endpoints),
        },
        flags: {
            hasGet: methods.has('get'),
            hasPost: methods.has('post'),
            hasPut: methods.has('put'),
            hasDelete: methods.has('delete'),
            isSuitelet: options.suitelet,
        },
    };
    const endpointContext = (endpoint: EndpointSpec): RenderContext => ({
        tokens: { ...context.tokens, endpointName: endpoint.name, EndpointName: capitalize(endpoint.name), METHOD: endpoint.method.toUpperCase() },
        flags: context.flags,
    });

    const projectDir = options.projectDir;
    const controllerDir = path.join(projectDir, 'api', 'src', 'controllers', options.controllerName);
    const netsuitePath = path.join(projectDir, 'common', 'netsuite.ts');

    const netsuiteSource = await fs.readFile(netsuitePath, 'utf8').catch(() => {
        throw new ControllerGenerationError(`${netsuitePath} not found.`);
    });
    const scriptsEntry = renderTemplateString(templates.scriptsEntry, context, 'scriptsEntry');
    const updatedNetsuiteSource = insertScriptsEntry(netsuiteSource, scriptsEntry, options.controllerName);

    const plannedFiles: Array<{ filePath: string; content: string }> = [
        { filePath: path.join(controllerDir, `${options.controllerName}Controller.ts`), content: renderTemplateString(templates.controller, context, 'controller') },
        { filePath: path.join(controllerDir, 'endpoints', 'index.ts'), content: renderTemplateString(templates.endpointsIndex, context, 'endpointsIndex') },
        ...options.endpoints.map((endpoint) => ({
            filePath: path.join(controllerDir, 'endpoints', `${endpoint.name}.ts`),
            content: renderTemplateString(templates.endpoint, endpointContext(endpoint), `endpoint.${endpoint.name}`),
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
