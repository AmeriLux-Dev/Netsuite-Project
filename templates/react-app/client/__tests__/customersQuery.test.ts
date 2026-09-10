import { describe, expect, it, vi } from 'vitest';
import { scripts } from 'common/netsuite';

vi.mock('@/api/apiClient', () => ({
    callEndpoint: vi.fn(async () => ({ customers: [], limit: 50 })),
}));

import { callEndpoint } from '@/api/apiClient';
import { fetchCustomers } from '@/api/customersApi';
import { customersQueryKey, customersQueryOptions } from '@/features/customers/useCustomers';

describe('customersQueryKey', () => {
    it('is stable for equal requests and distinct for different ones', () => {
        expect(customersQueryKey({ search: 'a' })).toEqual(customersQueryKey({ search: 'a' }));
        expect(customersQueryKey({})).toEqual(['customers', { search: '', limit: null }]);
        expect(customersQueryKey({ search: 'a' })).not.toEqual(customersQueryKey({ search: 'b' }));
    });
});

describe('fetchCustomers', () => {
    it('calls the customers controller with GET and the request as query parameters', async () => {
        await fetchCustomers({ search: 'acme', limit: 10 });
        expect(callEndpoint).toHaveBeenCalledWith(scripts.customers, 'GET', expect.objectContaining({ query: { search: 'acme', limit: 10 } }));
    });
});

describe('customersQueryOptions', () => {
    it('binds the query function to the request', async () => {
        const options = customersQueryOptions({ search: 'zeta' });
        expect(options.queryKey).toEqual(customersQueryKey({ search: 'zeta' }));
        const queryFunction = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
        await expect(queryFunction({ signal: new AbortController().signal })).resolves.toEqual({ customers: [], limit: 50 });
    });
});
