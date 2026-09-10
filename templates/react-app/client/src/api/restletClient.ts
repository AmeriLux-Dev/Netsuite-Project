import type { ScriptRef } from 'common/netsuite';
import type { ApiEnvelope } from 'common/types/api';

/**
 * Calls a restlet by its script and deployment ids. In the deployed Suitelet the call rides
 * the NetSuite session on the same origin; in development it goes through the local proxy.
 */

export type RestletMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type RestletQuery = Record<string, string | number | boolean | undefined | null>;

export interface RestletCallOptions {
    query?: RestletQuery;
    body?: unknown;
    signal?: AbortSignal;
}

export class RestletError extends Error {
    constructor(readonly status: number, message: string, readonly details?: unknown) {
        super(message);
        this.name = 'RestletError';
    }
}

export const RESTLET_BASE_PATH = import.meta.env.DEV ? '/api/restlet' : '/app/site/hosting/restlet.nl';

export function buildRestletUrl(scriptRef: ScriptRef, query: RestletQuery = {}): string {
    const parameters = new URLSearchParams({ script: scriptRef.scriptId, deploy: scriptRef.deployId });
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        parameters.set(key, String(value));
    }
    return `${RESTLET_BASE_PATH}?${parameters.toString()}`;
}

export async function callRestlet<TData>(scriptRef: ScriptRef, method: RestletMethod, options: RestletCallOptions = {}): Promise<TData> {
    const response = await fetch(buildRestletUrl(scriptRef, options.query), {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
    });

    let envelope: ApiEnvelope<TData> | undefined;
    const text = await response.text();
    try {
        envelope = text ? (JSON.parse(text) as ApiEnvelope<TData>) : undefined;
    } catch {
        envelope = undefined;
    }

    if (!envelope || typeof envelope !== 'object' || !('status' in envelope)) {
        throw new RestletError(response.status, `Unexpected response from ${scriptRef.scriptId} (${response.status})`, text.slice(0, 500));
    }
    if (envelope.error !== null || envelope.status >= 400) {
        throw new RestletError(envelope.status, envelope.error ?? `Request failed (${envelope.status})`);
    }
    return envelope.data as TData;
}
