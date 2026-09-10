import * as log from 'N/log';
import type { ApiEnvelope } from 'common/types/api';
import { ApiError } from './apiError';

/**
 * The one shared primitive for restlet controllers.
 *
 * Each handler is a plain synchronous function from a parsed request to a response value.
 * The wrapper parses the incoming body (NetSuite hands GET parameters as an object and
 * bodies as either an object or a JSON string), wraps the result in the ApiEnvelope, maps
 * ApiError to its status, hides everything else behind a 500, and audits the timing.
 */

export type RestletHandler<TRequest, TResponse> = (request: TRequest) => TResponse;

/** A handler for any request type is assignable here: parameters are contravariant and `never` sits below every type. */
export type AnyRestletHandler = RestletHandler<never, unknown>;

export interface RestletHandlers {
    get?: AnyRestletHandler;
    post?: AnyRestletHandler;
    put?: AnyRestletHandler;
    delete?: AnyRestletHandler;
}

export type RestletEntryPoint = (requestParameters: unknown) => ApiEnvelope<unknown>;

export interface DefinedRestlet {
    get: RestletEntryPoint;
    post: RestletEntryPoint;
    put: RestletEntryPoint;
    delete: RestletEntryPoint;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export function parseRestletRequest(requestParameters: unknown): unknown {
    if (typeof requestParameters !== 'string') return requestParameters ?? {};
    const trimmed = requestParameters.trim();
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

function wrapHandler(controllerName: string, method: HttpMethod, handler: AnyRestletHandler | undefined): RestletEntryPoint {
    const operation = `${controllerName}.${method}`;
    if (!handler) {
        return () => ({ status: 405, error: `${method} is not supported by ${controllerName}`, data: null });
    }
    return (requestParameters: unknown) => {
        const started = Date.now();
        let status = 200;
        try {
            const request = parseRestletRequest(requestParameters);
            const data = handler(request as never);
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
    };
}

export function defineRestlet(controllerName: string, handlers: RestletHandlers): DefinedRestlet {
    return {
        get: wrapHandler(controllerName, 'GET', handlers.get),
        post: wrapHandler(controllerName, 'POST', handlers.post),
        put: wrapHandler(controllerName, 'PUT', handlers.put),
        delete: wrapHandler(controllerName, 'DELETE', handlers.delete),
    };
}
