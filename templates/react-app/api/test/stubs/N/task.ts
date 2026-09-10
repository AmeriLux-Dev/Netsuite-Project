import { vi } from 'vitest';

export const create = vi.fn(() => ({ submit: vi.fn(() => 'TASK_ID') }));
export const checkStatus = vi.fn();
export const TaskType = { MAP_REDUCE: 'MAP_REDUCE', SCHEDULED_SCRIPT: 'SCHEDULED_SCRIPT' };
