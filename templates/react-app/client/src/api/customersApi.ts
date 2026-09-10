import { scripts } from 'common/netsuite';
import type { CustomerListRequest, CustomerListResponse } from 'common/types/customers';
import { callEndpoint } from './apiClient';

export function fetchCustomers(request: CustomerListRequest = {}, signal?: AbortSignal): Promise<CustomerListResponse> {
    return callEndpoint<CustomerListResponse>(scripts.customers, 'GET', {
        query: { search: request.search, limit: request.limit },
        signal,
    });
}
