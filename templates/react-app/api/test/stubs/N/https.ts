import { vi } from 'vitest';

export const get = vi.fn();
export const post = vi.fn();
export const put = vi.fn();
export const request = vi.fn();
export const requestRestlet = vi.fn();
export const requestSuitelet = vi.fn();
const deleteRequest = vi.fn();
export { deleteRequest as delete };
export const Method = { GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE' };
