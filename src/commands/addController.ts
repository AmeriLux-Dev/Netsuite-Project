import { findProjectRoot, readProjectConfig } from '../projectConfig.js';
import { generateController, parseEndpoints } from '../generators/controller/index.js';
import { ui } from '../prompts.js';

export interface AddControllerCommandOptions {
    /** `list:get,byId:get,create:post`; a bare name answers GET. */
    endpoints?: string;
    suitelet?: boolean;
    cwd?: string;
}

export async function runAddController(controllerName: string, options: AddControllerCommandOptions): Promise<void> {
    const startDir = options.cwd ?? process.cwd();
    const projectDir = await findProjectRoot(startDir);
    if (!projectDir) {
        throw new Error('No .netsuite-project.json found here or in a parent folder. Run this inside a project created by create-netsuite-project.');
    }
    const config = await readProjectConfig(projectDir);
    const endpoints = parseEndpoints(options.endpoints);

    const generated = await generateController({
        projectDir,
        config,
        controllerName,
        endpoints,
        suitelet: Boolean(options.suitelet),
    });

    ui.success(`Added ${options.suitelet ? 'suitelet' : 'restlet'} controller "${controllerName}" (${generated.scriptId}) with endpoints ${endpoints.map((endpoint) => endpoint.name).join(', ')}.`);
    ui.note(generated.writtenFiles.join('\n'), 'Files written');
    ui.info('Next: implement the endpoints under api/src/controllers/' + controllerName + '/endpoints/, then run `npm run deploy` to create the script record and deployment.');
}
