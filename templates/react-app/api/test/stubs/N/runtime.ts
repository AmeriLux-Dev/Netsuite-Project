import { vi } from 'vitest';

export const getCurrentScript = vi.fn(() => ({ id: 'customscript_test', deploymentId: 'customdeploy_test', getParameter: vi.fn(), getRemainingUsage: () => 1000 }));
export const getCurrentUser = vi.fn(() => ({ id: 1, name: 'Test User', role: 3, email: 'test@example.com' }));
export const getCurrentSession = vi.fn(() => ({ get: vi.fn(), set: vi.fn() }));
export const isFeatureInEffect = vi.fn(() => false);
export const accountId = 'TSTDRV0000000';
export const envType = 'SANDBOX';
export const EnvType = { SANDBOX: 'SANDBOX', PRODUCTION: 'PRODUCTION' };
