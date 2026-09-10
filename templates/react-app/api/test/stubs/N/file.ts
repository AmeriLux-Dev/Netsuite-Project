import { vi } from 'vitest';

export const load = vi.fn((options: { id: number | string }) => ({ id: options.id, url: `/core/media/media.nl?id=${options.id}`, getContents: () => '' }));
export const create = vi.fn();
const deleteFile = vi.fn();
export { deleteFile as delete };
export const Type = { PLAINTEXT: 'PLAINTEXT', JAVASCRIPT: 'JAVASCRIPT' };
