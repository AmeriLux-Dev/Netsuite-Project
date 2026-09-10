/** Every restlet answers with this envelope; `data` is null whenever `error` is set. */
export interface ApiEnvelope<TData> {
    status: number;
    error: string | null;
    data: TData | null;
}

/** The body of a failed call, as thrown by the client's RestletError. */
export interface ApiErrorBody {
    status: number;
    error: string;
    details?: unknown;
}
