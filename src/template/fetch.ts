import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extract } from 'tar';

/**
 * Downloads `<projectType>` from a GitHub ref of the template repository as a tarball and
 * extracts just that subtree. No git checkout, no extra dependency beyond `tar`.
 *
 * The defaults come from package.json's `templateSource` field (injected at build time), so a
 * CLI release always scaffolds from one pinned template ref.
 */

export const DEFAULT_TEMPLATE_REPOSITORY = __TEMPLATE_REPOSITORY__;
export const DEFAULT_TEMPLATE_REF = __TEMPLATE_REF__;

export interface TemplateFetchOptions {
    /** `owner/repo` on github.com; each template is a folder at the repository root. */
    repository: string;
    /** Tag, branch or commit. */
    ref: string;
    projectType: string;
    destinationDir: string;
    fetchImplementation?: typeof fetch;
}

export class TemplateFetchError extends Error {
    constructor(message: string, readonly url: string, readonly status?: number) {
        super(message);
        this.name = 'TemplateFetchError';
    }
}

export function buildTemplateArchiveUrl(repository: string, ref: string): string {
    const segments = repository.split('/');
    if (segments.length !== 2 || !segments[0] || !segments[1]) {
        throw new Error(`Repository must be "owner/repo", got "${repository}".`);
    }
    return `https://codeload.github.com/${segments[0]}/${segments[1]}/tar.gz/${encodeURIComponent(ref)}`;
}

/** Keep only `<archive-root>/<projectType>/**`; the root folder is `<repo>-<ref>` and is stripped along with `<projectType>`. */
export function isTemplateArchiveEntry(entryPath: string, projectType: string): boolean {
    const segments = entryPath.replace(/\\/g, '/').split('/');
    return segments.length >= 3 && segments[1] === projectType;
}

export async function downloadTemplate(options: TemplateFetchOptions): Promise<void> {
    const fetchImplementation = options.fetchImplementation ?? fetch;
    const url = buildTemplateArchiveUrl(options.repository, options.ref);

    const response = await fetchImplementation(url);
    if (!response.ok) {
        const hint = response.status === 404
            ? ` Ref "${options.ref}" was not found on ${options.repository}. Try --ref main, or --local-template <path> to scaffold from a checkout.`
            : '';
        throw new TemplateFetchError(
            `Template download failed (${response.status} ${response.statusText}).${hint}`,
            url,
            response.status,
        );
    }

    const scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-netsuite-project-'));
    const archivePath = path.join(scratchDir, 'template.tar.gz');
    try {
        await fs.writeFile(archivePath, new Uint8Array(await response.arrayBuffer()));
        await fs.mkdir(options.destinationDir, { recursive: true });
        await extract({
            file: archivePath,
            cwd: options.destinationDir,
            strip: 2,
            filter: (entryPath) => isTemplateArchiveEntry(entryPath, options.projectType),
        });
    } finally {
        await fs.rm(scratchDir, { recursive: true, force: true });
    }

    const extracted = await fs.readdir(options.destinationDir);
    if (extracted.length === 0) {
        throw new TemplateFetchError(
            `The archive at ${options.repository}@${options.ref} has no ${options.projectType} folder.`,
            url,
        );
    }
}
