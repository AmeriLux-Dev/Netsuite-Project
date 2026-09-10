import { vi } from 'vitest';

export const create = vi.fn(() => ({
    run: () => ({ getRange: () => [], each: () => undefined }),
}));
export const load = vi.fn();
export const lookupFields = vi.fn();
export const Operator = { IS: 'is', ANYOF: 'anyof', CONTAINS: 'contains' };
export const Type = {};
