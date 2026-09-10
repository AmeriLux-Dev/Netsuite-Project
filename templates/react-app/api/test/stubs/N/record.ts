import { vi } from 'vitest';

export const load = vi.fn();
export const create = vi.fn();
export const copy = vi.fn();
export const transform = vi.fn();
export const submitFields = vi.fn();
export const attach = vi.fn();
export const detach = vi.fn();
const deleteRecord = vi.fn();
export { deleteRecord as delete };
export const Type = { CUSTOMER: 'customer', FOLDER: 'folder' };
