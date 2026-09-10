import type { ScriptKind, ScriptRef } from 'common/netsuite';
import type { ApiEnvelope } from 'common/types/api';

/**
 * Calls an API controller by its script and deployment ids. The entry's `kind` decides the URL,
 * so a controller can move between Restlet and Suitelet without touching the caller. In the
 * deployed app the call rides the NetSuite session on the same origin; in development it goes
 * through the local proxy in server.ts.
 */

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ApiQuery = Record<string, string | number | boolean | undefined | null>;

export interface ApiCallOptions {
    query?: ApiQuery;
    body?: unknown;
    signal?: AbortSignal;
}

export class ApiClientError extends Error {
    constructor(readonly status: number, message: string, readonly details?: unknown) {
        super(message);
        this.name = 'ApiClientError';
    }
}

export const API_BASE_PATHS: Record<ScriptKind, string> = import.meta.env.DEV
    ? { restlet: '/api/restlet', suitelet: '/api/suitelet' }
    : { restlet: '/app/site/hosting/restlet.nl', suitelet: '/app/site/hosting/scriptlet.nl' };

export function buildApiUrl(scriptRef: ScriptRef, query: ApiQuery = {}): string {
    const parameters = new URLSearchParams({ script: scriptRef.scriptId, deploy: scriptRef.deployId });
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        parameters.set(key, String(value));
    }
    return `${API_BASE_PATHS[scriptRef.kind]}?${parameters.toString()}`;
}

export async function callEndpoint<TData>(scriptRef: ScriptRef, method: ApiMethod, options: ApiCallOptions = {}): Promise<TData> {
    const response = await fetch(buildApiUrl(scriptRef, options.query), {
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
        throw new ApiClientError(response.status, `Unexpected response from ${scriptRef.scriptId} (${response.status})`, text.slice(0, 500));
    }
    if (envelope.error !== null || envelope.status >= 400) {
        throw new ApiClientError(envelope.status, envelope.error ?? `Request failed (${envelope.status})`);
    }
    return envelope.data as TData;
}
