import { scripts } from 'common/netsuite';
import type { CustomerListRequest, CustomerListResponse } from 'common/types/customers';
import { callRestlet } from './restletClient';

export function fetchCustomers(request: CustomerListRequest = {}, signal?: AbortSignal): Promise<CustomerListResponse> {
    return callRestlet<CustomerListResponse>(scripts.customers, 'GET', {
        query: { search: request.search, limit: request.limit },
        signal,
    });
}
