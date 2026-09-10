import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { create as createTar } from 'tar';
import { afterEach, describe, expect, it } from 'vitest';
import {
    buildTemplateArchiveUrl,
    DEFAULT_TEMPLATE_REF,
    DEFAULT_TEMPLATE_REPOSITORY,
    downloadTemplate,
    isTemplateArchiveEntry,
    TemplateFetchError,
} from '../src/template/fetch.js';

describe('default template source', () => {
    it('comes from the build-time definition of package.json templateSource', () => {
        expect(DEFAULT_TEMPLATE_REPOSITORY).toBe('owner/templates');
        expect(DEFAULT_TEMPLATE_REF).toBe('v0.0.0-test');
    });
});

describe('buildTemplateArchiveUrl', () => {
    it('targets codeload with the ref encoded', () => {
        expect(buildTemplateArchiveUrl('owner/repo', 'v1.2.3')).toBe('https://codeload.github.com/owner/repo/tar.gz/v1.2.3');
        expect(buildTemplateArchiveUrl('owner/repo', 'feature/x')).toBe('https://codeload.github.com/owner/repo/tar.gz/feature%2Fx');
        expect(() => buildTemplateArchiveUrl('nope', 'main')).toThrow(/owner\/repo/);
    });
});

describe('isTemplateArchiveEntry', () => {
    it('keeps only the requested template folder at the archive root', () => {
        expect(isTemplateArchiveEntry('repo-main/react-app/package.json', 'react-app')).toBe(true);
        expect(isTemplateArchiveEntry('repo-main/react-app/api/src/x.ts', 'react-app')).toBe(true);
        expect(isTemplateArchiveEntry('repo-main/scripts-only/package.json', 'react-app')).toBe(false);
        expect(isTemplateArchiveEntry('repo-main/scripts/e2e.mjs', 'react-app')).toBe(false);
        expect(isTemplateArchiveEntry('repo-main/README.md', 'react-app')).toBe(false);
        expect(isTemplateArchiveEntry('repo-main/react-app', 'react-app')).toBe(false);
    });
});

describe('downloadTemplate', () => {
    const scratchDirs: string[] = [];

    afterEach(async () => {
        for (const dir of scratchDirs.splice(0)) {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    async function buildArchive(): Promise<Buffer> {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fetch-test-'));
        scratchDirs.push(root);
        const archiveRoot = path.join(root, 'repo-main');
        await fs.mkdir(path.join(archiveRoot, 'react-app', 'api'), { recursive: true });
        await fs.mkdir(path.join(archiveRoot, 'other'), { recursive: true });
        await fs.mkdir(path.join(archiveRoot, 'scripts'), { recursive: true });
        await fs.writeFile(path.join(archiveRoot, 'react-app', 'package.json'), '{}');
        await fs.writeFile(path.join(archiveRoot, 'react-app', 'api', 'a.ts'), 'export {};');
        await fs.writeFile(path.join(archiveRoot, 'other', 'package.json'), '{}');
        await fs.writeFile(path.join(archiveRoot, 'scripts', 'e2e.mjs'), 'nope');
        await fs.writeFile(path.join(archiveRoot, 'README.md'), 'nope');
        const archivePath = path.join(root, 'archive.tgz');
        await createTar({ gzip: true, file: archivePath, cwd: root }, ['repo-main']);
        return fs.readFile(archivePath);
    }

    it('extracts only <type>/, stripping the archive root', async () => {
        const archive = await buildArchive();
        const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'fetch-dest-'));
        scratchDirs.push(destination);
        const fetchImplementation = (async () => new Response(archive, { status: 200 })) as unknown as typeof fetch;

        await downloadTemplate({ repository: 'owner/repo', ref: 'main', projectType: 'react-app', destinationDir: destination, fetchImplementation });

        expect((await fs.readdir(destination)).sort()).toEqual(['api', 'package.json']);
        expect(await fs.readFile(path.join(destination, 'api', 'a.ts'), 'utf8')).toBe('export {};');
    });

    it('reports a missing ref with a hint and writes nothing', async () => {
        const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'fetch-dest-'));
        scratchDirs.push(destination);
        const fetchImplementation = (async () => new Response('', { status: 404, statusText: 'Not Found' })) as unknown as typeof fetch;

        await expect(downloadTemplate({ repository: 'owner/repo', ref: 'v9.9.9', projectType: 'react-app', destinationDir: destination, fetchImplementation }))
            .rejects.toThrow(/--ref main/);
        expect(await fs.readdir(destination)).toEqual([]);
    });

    it('fails when the archive has no such template', async () => {
        const archive = await buildArchive();
        const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'fetch-dest-'));
        scratchDirs.push(destination);
        const fetchImplementation = (async () => new Response(archive, { status: 200 })) as unknown as typeof fetch;

        await expect(downloadTemplate({ repository: 'owner/repo', ref: 'main', projectType: 'missing', destinationDir: destination, fetchImplementation }))
            .rejects.toBeInstanceOf(TemplateFetchError);
    });
});
