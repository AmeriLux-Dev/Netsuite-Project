import { vi } from 'vitest';

export const create = vi.fn((options: { name: string; message: string }) => {
    const suiteScriptError = new Error(options.message);
    suiteScriptError.name = options.name;
    return suiteScriptError;
});
