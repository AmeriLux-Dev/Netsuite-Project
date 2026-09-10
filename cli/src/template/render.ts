import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * The template language: `{{token}}` substitution, non-nested `{{#if flag}}…{{/if}}`
 * and `{{#unless flag}}…{{/unless}}` blocks, tokens in file names, and a rename map for
 * files npm would otherwise strip from a published package.
 */

export interface RenderContext {
    tokens: Record<string, string>;
    flags: Record<string, boolean>;
}

export const RENAMED_FILES: Record<string, string> = {
    _gitignore: '.gitignore',
    _npmrc: '.npmrc',
};

export const SUBSTITUTED_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.html', '.xml', '.md', '.css',
    '.yml', '.yaml', '.txt', '.example',
]);

export const SUBSTITUTED_FILE_NAMES = new Set(['_gitignore', '_npmrc', '.env.example', '.gitignore', '.npmrc']);

export class TemplateRenderError extends Error {
    constructor(message: string, readonly file: string) {
        super(`${file}: ${message}`);
        this.name = 'TemplateRenderError';
    }
}

// Group 1 is the indent when the tag opens a line; groups 4 and 6 are the newlines that end
// the open and close tag lines when those tags stand alone. Inline tags leave surrounding text intact.
const BLOCK_PATTERN = /(?:^([ \t]*))?\{\{#(if|unless)\s+([A-Za-z0-9_]+)\}\}(?:[ \t]*(\r?\n))?([\s\S]*?)\{\{\/\2\}\}(?:[ \t]*(\r?\n))?/gm;
const TOKEN_PATTERN = /\{\{([A-Za-z0-9_]+)\}\}/g;
const LEFTOVER_PATTERN = /\{\{/;

export function isSubstitutedFile(fileName: string): boolean {
    if (SUBSTITUTED_FILE_NAMES.has(fileName)) return true;
    return SUBSTITUTED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

/** Inside a JSON document a token value must be a valid string body: quotes, backslashes and control characters escaped. */
function escapeTokenValueForJson(value: string): string {
    return JSON.stringify(value).slice(1, -1);
}

export function renderTemplateString(source: string, context: RenderContext, fileLabel = '<string>'): string {
    const jsonContext = fileLabel.toLowerCase().endsWith('.json');
    const withBlocks = source.replace(
        BLOCK_PATTERN,
        (
            _match: string,
            indent: string | undefined,
            kind: string,
            flag: string,
            openNewline: string | undefined,
            body: string,
            closeNewline: string | undefined,
        ) => {
            if (!(flag in context.flags)) {
                throw new TemplateRenderError(`unknown flag "${flag}" in {{#${kind}}} block`, fileLabel);
            }
            const keep = kind === 'if' ? context.flags[flag] : !context.flags[flag];
            if (!keep) return '';
            // A block whose open tag sat on its own line keeps the body verbatim (the tag lines vanish);
            // an inline block keeps its surroundings, so `{{#if x}}foo{{/if}} bar` stays on one line.
            if (openNewline) return body;
            return `${indent ?? ''}${body}${closeNewline ?? ''}`;
        },
    );

    const withTokens = withBlocks.replace(TOKEN_PATTERN, (_match, token: string) => {
        const value = context.tokens[token];
        if (value === undefined) {
            throw new TemplateRenderError(`unknown token "{{${token}}}"`, fileLabel);
        }
        return jsonContext ? escapeTokenValueForJson(value) : value;
    });

    if (LEFTOVER_PATTERN.test(withTokens)) {
        const line = withTokens.split(/\r?\n/).findIndex((text) => text.includes('{{')) + 1;
        throw new TemplateRenderError(`unrendered "{{" left on line ${line}`, fileLabel);
    }
    return withTokens;
}

export function renderTemplateFileName(fileName: string, context: RenderContext): string {
    const renamed = RENAMED_FILES[fileName] ?? fileName;
    return renamed.replace(TOKEN_PATTERN, (_match, token: string) => {
        const value = context.tokens[token];
        if (value === undefined) {
            throw new TemplateRenderError(`unknown token "{{${token}}}" in file name`, fileName);
        }
        return value;
    });
}

export interface RenderDirectoryOptions {
    /** Directory names never copied from the template (defaults to node_modules). */
    skipDirectories?: Set<string>;
}

/**
 * Copies `sourceDir` into `targetDir`, rendering text files and file names on the way.
 * Existing files in `targetDir` are left alone unless the template provides the same path,
 * so notes or docs that predate the scaffold survive it. Returns the written relative paths.
 */
export async function renderTemplateDirectory(
    sourceDir: string,
    targetDir: string,
    context: RenderContext,
    options: RenderDirectoryOptions = {},
): Promise<string[]> {
    const skipDirectories = options.skipDirectories ?? new Set(['node_modules']);
    const written: string[] = [];

    async function walk(currentSource: string, currentTarget: string, relativePrefix: string): Promise<void> {
        await fs.mkdir(currentTarget, { recursive: true });
        const entries = await fs.readdir(currentSource, { withFileTypes: true });
        for (const entry of entries) {
            const sourcePath = path.join(currentSource, entry.name);
            const renderedName = renderTemplateFileName(entry.name, context);
            const targetPath = path.join(currentTarget, renderedName);
            const relativePath = relativePrefix ? `${relativePrefix}/${renderedName}` : renderedName;

            if (entry.isDirectory()) {
                if (skipDirectories.has(entry.name)) continue;
                await walk(sourcePath, targetPath, relativePath);
                continue;
            }
            if (!entry.isFile()) continue;

            if (isSubstitutedFile(entry.name)) {
                const source = await fs.readFile(sourcePath, 'utf8');
                const rendered = renderTemplateString(source, context, relativePath);
                await fs.writeFile(targetPath, rendered, 'utf8');
            } else {
                await fs.copyFile(sourcePath, targetPath);
            }
            written.push(relativePath);
        }
    }

    await walk(sourceDir, targetDir, '');
    return written.sort();
}
