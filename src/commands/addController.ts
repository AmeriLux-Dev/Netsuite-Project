import { findProjectRoot, readProjectConfig } from '../projectConfig.js';
import { generateController, parseMethods } from '../generators/controller/index.js';
import { ui } from '../prompts.js';

export interface AddControllerCommandOptions {
    methods?: string;
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
    const methods = parseMethods(options.methods);

    const generated = await generateController({
        projectDir,
        config,
        controllerName,
        methods,
        suitelet: Boolean(options.suitelet),
    });

    ui.success(`Added ${options.suitelet ? 'suitelet' : 'restlet'} controller "${controllerName}" (${generated.scriptId}).`);
    ui.note(generated.writtenFiles.join('\n'), 'Files written');
    ui.info('Next: implement the endpoints under api/src/controllers/' + controllerName + '/endpoints/, then run `npm run deploy` to create the script record and deployment.');
}
