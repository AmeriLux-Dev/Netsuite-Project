import { afterEach, describe, expect, it, vi } from 'vitest';
import { scripts } from 'common/netsuite';
import { buildRestletUrl, callRestlet, RestletError } from '@/api/restletClient';

function mockFetchResponse(status: number, body: unknown) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const fetchMock = vi.fn(async () => new Response(text, { status, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('buildRestletUrl', () => {
    it('always carries script and deploy ids and drops empty query values', () => {
        const url = buildRestletUrl(scripts.customers, { search: 'acme', limit: undefined, empty: '' });
        expect(url).toContain(`script=${scripts.customers.scriptId}`);
        expect(url).toContain(`deploy=${scripts.customers.deployId}`);
        expect(url).toContain('search=acme');
        expect(url).not.toContain('limit=');
        expect(url).not.toContain('empty=');
    });
});

describe('callRestlet', () => {
    it('unwraps the envelope data', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: { customers: [] } });
        await expect(callRestlet(scripts.customers, 'GET')).resolves.toEqual({ customers: [] });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sends a JSON body for writes', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: null });
        await callRestlet(scripts.customers, 'POST', { body: { name: 'x' } });
        const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.method).toBe('POST');
        expect(init.body).toBe('{"name":"x"}');
    });

    it('throws RestletError with the envelope status when the envelope carries an error', async () => {
        mockFetchResponse(200, { status: 404, error: 'Customer not found', data: null });
        await expect(callRestlet(scripts.customers, 'GET')).rejects.toMatchObject({ name: 'RestletError', status: 404, message: 'Customer not found' });
    });

    it('throws RestletError when the response is not an envelope', async () => {
        mockFetchResponse(500, '<html>login</html>');
        const failure = await callRestlet(scripts.customers, 'GET').catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(RestletError);
        expect((failure as RestletError).status).toBe(500);
    });
});
