import { vi } from 'vitest';

export const parse = vi.fn((options: { value: unknown }) => options.value);
export const format = vi.fn((options: { value: unknown }) => String(options.value));
export const Type = { DATE: 'date', DATETIME: 'datetime', CURRENCY: 'currency' };
