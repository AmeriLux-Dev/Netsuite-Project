import { vi } from 'vitest';

export const runSuiteQL = vi.fn(() => ({ asMappedResults: () => [], results: [] }));
export const runSuiteQLPaged = vi.fn();
export const create = vi.fn();
export const load = vi.fn();
export const Operator = {};
export const Type = {};
