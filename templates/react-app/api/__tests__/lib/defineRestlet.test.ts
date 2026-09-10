import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as log from 'N/log';
import { ApiError } from '../../src/lib/apiError';
import { defineRestlet, parseRestletRequest } from '../../src/lib/defineRestlet';

describe('parseRestletRequest', () => {
    it('passes objects through and treats an empty body as an empty object', () => {
        expect(parseRestletRequest({ a: 1 })).toEqual({ a: 1 });
        expect(parseRestletRequest(undefined)).toEqual({});
        expect(parseRestletRequest('')).toEqual({});
    });

    it('parses a JSON string body', () => {
        expect(parseRestletRequest('{"search":"acme"}')).toEqual({ search: 'acme' });
    });

    it('rejects a body that is not JSON as a 400', () => {
        expect(() => parseRestletRequest('not json')).toThrow(ApiError);
    });
});

describe('defineRestlet', () => {
    beforeEach(() => {
        vi.mocked(log.audit).mockClear();
        vi.mocked(log.error).mockClear();
    });

    it('wraps a handler result in the envelope and audits the call', () => {
        const restlet = defineRestlet('things', { get: (request: { id: string }) => ({ id: Number(request.id) }) });
        expect(restlet.get({ id: '7' })).toEqual({ status: 200, error: null, data: { id: 7 } });
        expect(log.audit).toHaveBeenCalledWith('things.GET', expect.objectContaining({ status: 200 }));
    });

    it('maps ApiError to its status and message', () => {
        const restlet = defineRestlet('things', { post: () => { throw ApiError.notFound('No such thing'); } });
        expect(restlet.post('{}')).toEqual({ status: 404, error: 'No such thing', data: null });
        expect(log.error).not.toHaveBeenCalled();
    });

    it('hides unexpected errors behind a 500 and logs them', () => {
        const restlet = defineRestlet('things', { put: () => { throw new Error('boom'); } });
        expect(restlet.put({})).toEqual({ status: 500, error: 'Internal Server Error', data: null });
        expect(log.error).toHaveBeenCalledWith('things.PUT', expect.objectContaining({ message: 'boom' }));
    });

    it('answers 405 for methods without a handler', () => {
        const restlet = defineRestlet('things', { get: () => [] });
        expect(restlet.delete({})).toMatchObject({ status: 405, data: null });
    });
});
