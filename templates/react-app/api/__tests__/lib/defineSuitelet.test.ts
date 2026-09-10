import { describe, expect, it, vi } from 'vitest';
import type { EntryPoints } from 'N/types';
import { ApiError } from '../../src/lib/apiError';
import { defineSuitelet } from '../../src/lib/defineSuitelet';
import { defineEndpoints } from '../../src/lib/endpoint';

/** The parts of a Suitelet context the wrapper touches, with the response captured for assertions. */
function createSuiteletContext(method: string, parameters: Record<string, string> = {}, body = '') {
    const write = vi.fn();
    const setHeader = vi.fn();
    const context = {
        request: { method, parameters, body },
        response: { write, setHeader },
    } as unknown as EntryPoints.Suitelet.onRequestContext;
    const written = () => JSON.parse((write.mock.calls[0] as [{ output: string }])[0].output) as unknown;
    return { context, write, setHeader, written };
}

const endpoints = defineEndpoints({
    get: (request: { id: string }) => ({ id: Number(request.id) }),
    post: (request: { name: string }) => {
        if (!request.name) throw ApiError.badRequest('name is required');
        return { created: request.name };
    },
});

describe('defineSuitelet', () => {
    it('serves GET from the query parameters as a JSON envelope', () => {
        const suitelet = defineSuitelet('things', endpoints);
        const { context, setHeader, written } = createSuiteletContext('GET', { id: '7', script: 'x', deploy: 'y' });
        suitelet(context);
        expect(setHeader).toHaveBeenCalledWith({ name: 'Content-Type', value: 'application/json' });
        expect(written()).toEqual({ status: 200, error: null, data: { id: 7 } });
    });

    it('serves POST from the JSON body', () => {
        const suitelet = defineSuitelet('things', endpoints);
        const { context, written } = createSuiteletContext('POST', {}, '{"name":"widget"}');
        suitelet(context);
        expect(written()).toEqual({ status: 200, error: null, data: { created: 'widget' } });
    });

    it('returns the same error envelope a Restlet would', () => {
        const suitelet = defineSuitelet('things', endpoints);
        const { context, written } = createSuiteletContext('POST', {}, '{}');
        suitelet(context);
        expect(written()).toEqual({ status: 400, error: 'name is required', data: null });
    });

    it('answers 405 for a method without an endpoint', () => {
        const suitelet = defineSuitelet('things', endpoints);
        const { context, written } = createSuiteletContext('DELETE');
        suitelet(context);
        expect(written()).toMatchObject({ status: 405, data: null });
    });
});
