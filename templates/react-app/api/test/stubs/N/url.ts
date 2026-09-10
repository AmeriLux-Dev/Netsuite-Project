import { vi } from 'vitest';

export const resolveScript = vi.fn(() => '/app/site/hosting/scriptlet.nl?script=1&deploy=1');
export const resolveRecord = vi.fn(() => '/app/common/entity/custjob.nl?id=1');
export const resolveDomain = vi.fn(() => 'localhost');
export const format = vi.fn((options: { domain: string }) => options.domain);
export const HostType = { APPLICATION: 'APPLICATION', RESTLET: 'RESTLET' };
