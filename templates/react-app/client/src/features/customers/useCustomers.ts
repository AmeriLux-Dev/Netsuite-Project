import { queryOptions, useQuery } from '@tanstack/react-query';
import type { CustomerListRequest } from 'common/types/customers';
import { fetchCustomers } from '@/api/customersApi';

export function customersQueryKey(request: CustomerListRequest) {
    return ['customers', { search: request.search ?? '', limit: request.limit ?? null }] as const;
}

export function customersQueryOptions(request: CustomerListRequest) {
    return queryOptions({
        queryKey: customersQueryKey(request),
        queryFn: ({ signal }) => fetchCustomers(request, signal),
    });
}

export function useCustomers(request: CustomerListRequest) {
    return useQuery(customersQueryOptions(request));
}
