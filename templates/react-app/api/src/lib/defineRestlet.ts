import type { ApiEnvelope } from 'common/types/api';
import { invokeEndpoint, type EndpointMap } from './endpoint';

/**
 * Exposes an endpoint map as Restlet entry points. A controller exports only the methods it
 * implements: `export const get = restlet.get;` and, for DELETE, `export { restletDelete as delete }`.
 */

export type RestletEntryPoint = (requestParameters: unknown) => ApiEnvelope<unknown>;

export interface DefinedRestlet {
    get: RestletEntryPoint;
    post: RestletEntryPoint;
    put: RestletEntryPoint;
    delete: RestletEntryPoint;
}

export function defineRestlet(controllerName: string, endpoints: EndpointMap): DefinedRestlet {
    return {
        get: (requestParameters) => invokeEndpoint(controllerName, 'GET', endpoints.get, requestParameters),
        post: (requestParameters) => invokeEndpoint(controllerName, 'POST', endpoints.post, requestParameters),
        put: (requestParameters) => invokeEndpoint(controllerName, 'PUT', endpoints.put, requestParameters),
        delete: (requestParameters) => invokeEndpoint(controllerName, 'DELETE', endpoints.delete, requestParameters),
    };
}
