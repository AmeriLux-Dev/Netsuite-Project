import * as log from 'N/log';
import type { ApiEnvelope } from 'common/types/api';
import { ApiError } from './apiError';

/**
 * Endpoints are the transport-agnostic unit of an API controller: a synchronous function from a
 * parsed request to a response value, living under `controllers/<name>/endpoints/`. The controller
 * file wraps them as a Restlet (`defineRestlet`) or a Suitelet (`defineSuitelet`); switching
 * transport is a change to that one file and its SDF object, never to the endpoints.
 */

export type Endpoint<TRequest, TResponse> = (request: TRequest) => TResponse;

/** An endpoint for any request type is assignable here: parameters are contravariant and `never` sits below every type. */
export type AnyEndpoint = Endpoint<never, unknown>;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface EndpointMap {
    get?: AnyEndpoint;
    post?: AnyEndpoint;
    put?: AnyEndpoint;
    delete?: AnyEndpoint;
}

/** Identity helper so an endpoint map is type-checked where it is declared. */
export function defineEndpoints<TMap extends EndpointMap>(endpoints: TMap): TMap {
    return endpoints;
}

/** NetSuite hands GET parameters as an object and bodies as either an object or a JSON string. */
export function parseEndpointRequest(rawRequest: unknown): unknown {
    if (typeof rawRequest !== 'string') return rawRequest ?? {};
    const trimmed = rawRequest.trim();
    if (trimmed === '') return {};
    try {
        return JSON.parse(trimmed);
    } catch {
        throw ApiError.badRequest('Request body is not valid JSON.');
    }
}

function describeError(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) return { message: error.message, stack: error.stack };
    return { message: String(error) };
}

export function endpointForMethod(endpoints: EndpointMap, method: string): AnyEndpoint | undefined {
    switch (method.toUpperCase()) {
        case 'GET': return endpoints.get;
        case 'POST': return endpoints.post;
        case 'PUT': return endpoints.put;
        case 'DELETE': return endpoints.delete;
        default: return undefined;
    }
}

/**
 * Runs one endpoint and produces the envelope: 200 with data, an ApiError's own status and
 * message, or 500 with the details logged. Audits the outcome and timing either way.
 */
export function invokeEndpoint(controllerName: string, method: HttpMethod, endpoint: AnyEndpoint | undefined, rawRequest: unknown): ApiEnvelope<unknown> {
    const operation = `${controllerName}.${method}`;
    if (!endpoint) {
        return { status: 405, error: `${method} is not supported by ${controllerName}`, data: null };
    }
    const started = Date.now();
    let status = 200;
    try {
        const request = parseEndpointRequest(rawRequest);
        const data = endpoint(request as never);
        return { status, error: null, data: data ?? null };
    } catch (error) {
        if (error instanceof ApiError) {
            status = error.status;
            log.debug(operation, { status, message: error.message, details: error.details });
            return { status, error: error.message, data: null };
        }
        status = 500;
        log.error(operation, describeError(error));
        return { status, error: 'Internal Server Error', data: null };
    } finally {
        log.audit(operation, { status, durationMs: Date.now() - started });
    }
}
