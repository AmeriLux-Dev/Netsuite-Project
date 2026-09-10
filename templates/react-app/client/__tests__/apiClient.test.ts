import { afterEach, describe, expect, it, vi } from 'vitest';
import { scripts, type ScriptRef } from 'common/netsuite';
import { ApiClientError, buildApiUrl, callEndpoint } from '@/api/apiClient';

function mockFetchResponse(status: number, body: unknown) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const fetchMock = vi.fn(async () => new Response(text, { status, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('buildApiUrl', () => {
    it('always carries script and deploy ids and drops empty query values', () => {
        const url = buildApiUrl(scripts.customers, { search: 'acme', limit: undefined, empty: '' });
        expect(url).toContain(`script=${scripts.customers.scriptId}`);
        expect(url).toContain(`deploy=${scripts.customers.deployId}`);
        expect(url).toContain('search=acme');
        expect(url).not.toContain('limit=');
        expect(url).not.toContain('empty=');
    });

    it('routes by the script kind', () => {
        const asSuitelet: ScriptRef = { ...scripts.customers, kind: 'suitelet' };
        expect(buildApiUrl(scripts.customers)).toMatch(/restlet/);
        expect(buildApiUrl(asSuitelet)).toMatch(/suitelet/);
        expect(buildApiUrl(asSuitelet)).not.toMatch(/restlet/);
    });
});

describe('callEndpoint', () => {
    it('unwraps the envelope data', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: { customers: [] } });
        await expect(callEndpoint(scripts.customers, 'GET')).resolves.toEqual({ customers: [] });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sends a JSON body for writes', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: null });
        await callEndpoint(scripts.customers, 'POST', { body: { name: 'x' } });
        const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.method).toBe('POST');
        expect(init.body).toBe('{"name":"x"}');
    });

    it('throws ApiClientError with the envelope status when the envelope carries an error', async () => {
        mockFetchResponse(200, { status: 404, error: 'Customer not found', data: null });
        await expect(callEndpoint(scripts.customers, 'GET')).rejects.toMatchObject({ name: 'ApiClientError', status: 404, message: 'Customer not found' });
    });

    it('throws ApiClientError when the response is not an envelope', async () => {
        mockFetchResponse(500, '<html>login</html>');
        const failure = await callEndpoint(scripts.customers, 'GET').catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(ApiClientError);
        expect((failure as ApiClientError).status).toBe(500);
    });
});
