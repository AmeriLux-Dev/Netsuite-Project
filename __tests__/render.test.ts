import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    isSubstitutedFile,
    renderTemplateDirectory,
    renderTemplateFileName,
    renderTemplateString,
    TemplateRenderError,
    type RenderContext,
} from '../src/template/render.js';

const context: RenderContext = {
    tokens: { appName: 'DemoApp', prefix: 'demo' },
    flags: { performanceTracker: true, other: false },
};

describe('renderTemplateString', () => {
    it('substitutes tokens', () => {
        expect(renderTemplateString('name={{appName}} id=customscript_{{prefix}}_x', context)).toBe('name=DemoApp id=customscript_demo_x');
    });

    it('keeps or drops standalone if/unless blocks, removing the tag lines', () => {
        const source = 'a\n{{#if performanceTracker}}\nkept\n{{/if}}\n{{#unless performanceTracker}}\ndropped\n{{/unless}}\nb\n';
        expect(renderTemplateString(source, context)).toBe('a\nkept\nb\n');
    });

    it('keeps inline blocks on their line', () => {
        expect(renderTemplateString('x {{#if performanceTracker}}yes{{/if}} y', context)).toBe('x yes y');
        expect(renderTemplateString('x {{#if other}}yes{{/if}} y', context)).toBe('x  y');
    });

    it('evaluates nested blocks, including same-kind nesting', () => {
        const source = [
            'start',
            '{{#unless other}}',
            'outer',
            '{{#if performanceTracker}}',
            'inner-kept',
            '{{/if}}',
            '{{#if other}}',
            'inner-dropped',
            '{{/if}}',
            '{{/unless}}',
            '{{#if performanceTracker}}',
            '{{#if performanceTracker}}',
            'deep',
            '{{/if}}',
            '{{/if}}',
            'end',
            '',
        ].join('\n');
        expect(renderTemplateString(source, context)).toBe('start\nouter\ninner-kept\ndeep\nend\n');
        expect(() => renderTemplateString('{{#if other}}open only', context, 'f')).toThrow(/unclosed/);
    });

    it('handles CRLF sources', () => {
        expect(renderTemplateString('a\r\n{{#if other}}\r\nno\r\n{{/if}}\r\nb\r\n', context)).toBe('a\r\nb\r\n');
    });

    it('escapes token values inside JSON files', () => {
        const jsonContext: RenderContext = { tokens: { description: 'Say "hi" to C:\\temp', appName: 'X' }, flags: {} };
        const rendered = renderTemplateString('{"description": "{{description}}"}', jsonContext, 'package.json');
        expect(JSON.parse(rendered)).toEqual({ description: 'Say "hi" to C:\\temp' });
        expect(renderTemplateString('{{description}}', jsonContext, 'README.md')).toBe('Say "hi" to C:\\temp');
    });

    it('fails on unknown tokens, unknown flags and leftover braces', () => {
        expect(() => renderTemplateString('{{nope}}', context, 'f.ts')).toThrow(TemplateRenderError);
        expect(() => renderTemplateString('{{#if nope}}x{{/if}}', context, 'f.ts')).toThrow(/unknown flag/);
        expect(() => renderTemplateString('{{ spaced }}', context, 'f.ts')).toThrow(/unrendered/);
    });
});

describe('renderTemplateFileName', () => {
    it('applies the rename map and file-name tokens', () => {
        expect(renderTemplateFileName('_gitignore', context)).toBe('.gitignore');
        expect(renderTemplateFileName('_npmrc', context)).toBe('.npmrc');
        expect(renderTemplateFileName('customscript_{{prefix}}_home.xml', context)).toBe('customscript_demo_home.xml');
        expect(renderTemplateFileName('{{appName}}', context)).toBe('DemoApp');
    });
});

describe('isSubstitutedFile', () => {
    it('renders text sources and copies everything else byte for byte', () => {
        expect(isSubstitutedFile('a.ts')).toBe(true);
        expect(isSubstitutedFile('a.xml')).toBe(true);
        expect(isSubstitutedFile('.env.example')).toBe(true);
        expect(isSubstitutedFile('netsuite-project.code-snippets')).toBe(true);
        expect(isSubstitutedFile('_gitignore')).toBe(true);
        expect(isSubstitutedFile('logo.png')).toBe(false);
        expect(isSubstitutedFile('.gitkeep')).toBe(false);
    });
});

describe('renderTemplateDirectory', () => {
    const scratchDirs: string[] = [];

    afterEach(async () => {
        for (const dir of scratchDirs.splice(0)) {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it('renders files and names, skips node_modules, preserves unrelated existing files', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'render-test-'));
        scratchDirs.push(root);
        const source = path.join(root, 'template');
        const target = path.join(root, 'out');
        await fs.mkdir(path.join(source, 'netsuite', 'Objects'), { recursive: true });
        await fs.mkdir(path.join(source, 'node_modules', 'x'), { recursive: true });
        await fs.mkdir(target, { recursive: true });
        await fs.writeFile(path.join(source, '_gitignore'), 'node_modules\n');
        await fs.writeFile(path.join(source, 'netsuite', 'Objects', 'customscript_{{prefix}}_home.xml'), '<x name="{{appName}}"/>');
        await fs.writeFile(path.join(source, 'node_modules', 'x', 'index.js'), 'nope');
        await fs.writeFile(path.join(source, 'raw.bin'), Buffer.from([0x7b, 0x7b, 0x00]));
        await fs.writeFile(path.join(target, 'NOTES.md'), 'keep me');

        const written = await renderTemplateDirectory(source, target, context);

        expect(written).toEqual(['.gitignore', 'netsuite/Objects/customscript_demo_home.xml', 'raw.bin']);
        expect(await fs.readFile(path.join(target, 'netsuite', 'Objects', 'customscript_demo_home.xml'), 'utf8')).toBe('<x name="DemoApp"/>');
        expect(await fs.readFile(path.join(target, 'NOTES.md'), 'utf8')).toBe('keep me');
        expect(await fs.readFile(path.join(target, 'raw.bin'))).toEqual(Buffer.from([0x7b, 0x7b, 0x00]));
        await expect(fs.access(path.join(target, 'node_modules'))).rejects.toBeDefined();
    });

    it('honours template.json conditional paths and never copies the manifest itself', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'render-manifest-'));
        scratchDirs.push(root);
        const source = path.join(root, 'template');
        await fs.mkdir(path.join(source, 'guarded', 'nested'), { recursive: true });
        await fs.writeFile(path.join(source, 'template.json'), JSON.stringify({
            conditionalPaths: { 'probity.config.ts': 'probity', 'guarded': 'probity', 'plain.md': '!probity' },
        }));
        await fs.writeFile(path.join(source, 'probity.config.ts'), 'export default {};');
        await fs.writeFile(path.join(source, 'guarded', 'nested', 'a.ts'), 'export {};');
        await fs.writeFile(path.join(source, 'plain.md'), '# plain');
        await fs.writeFile(path.join(source, 'always.md'), '# always');

        const withProbity = path.join(root, 'with');
        const written = await renderTemplateDirectory(source, withProbity, { tokens: {}, flags: { probity: true } });
        expect(written).toEqual(['always.md', 'guarded/nested/a.ts', 'probity.config.ts']);

        const withoutProbity = path.join(root, 'without');
        const writtenWithout = await renderTemplateDirectory(source, withoutProbity, { tokens: {}, flags: { probity: false } });
        expect(writtenWithout).toEqual(['always.md', 'plain.md']);

        await expect(renderTemplateDirectory(source, path.join(root, 'bad'), { tokens: {}, flags: {} })).rejects.toThrow(/unknown flag/);
    });
});
