import type { EntryPoints } from 'N/types';
import { endpointForMethod, invokeEndpoint, type EndpointMap, type HttpMethod } from './endpoint';

/**
 * Exposes the same endpoint map as a JSON Suitelet: `export const onRequest = defineSuitelet(...)`.
 * GET reads the query parameters, other methods read the JSON body. The response is the same
 * envelope a Restlet returns, so the client does not care which transport answered.
 */

export type SuiteletEntryPoint = (context: EntryPoints.Suitelet.onRequestContext) => void;

const SUPPORTED_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

function toHttpMethod(method: string): HttpMethod {
    const upper = method.toUpperCase() as HttpMethod;
    return SUPPORTED_METHODS.includes(upper) ? upper : 'GET';
}

export function defineSuitelet(controllerName: string, endpoints: EndpointMap): SuiteletEntryPoint {
    return (context) => {
        const method = toHttpMethod(context.request.method);
        const rawRequest = method === 'GET' ? context.request.parameters : context.request.body;
        const envelope = invokeEndpoint(controllerName, method, endpointForMethod(endpoints, method), rawRequest);
        context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
        context.response.write({ output: JSON.stringify(envelope) });
    };
}
