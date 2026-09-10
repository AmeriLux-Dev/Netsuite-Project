import type { Specification } from '@amerilux/netsuite-repository';
import type { CustomerListRequest, CustomerListResponse, CustomerSummary } from 'common/types/customers';
import type { AppContext } from '../models/generated/context.gen';
import { CustomerFields, type Customer } from '../models/generated/Customer.gen';

/**
 * Pure domain logic: takes the repository context, returns plain data. No N/* imports,
 * so a test passes a fake context and asserts on the specifications it receives.
 */

export const DEFAULT_CUSTOMER_LIMIT = 50;
export const MAX_CUSTOMER_LIMIT = 500;

export type CustomerContext = Pick<AppContext, 'customers'>;

export function clampCustomerLimit(requested: number | string | undefined): number {
    const parsed = typeof requested === 'string' ? Number.parseInt(requested, 10) : requested;
    if (parsed === undefined || Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CUSTOMER_LIMIT;
    return Math.min(parsed, MAX_CUSTOMER_LIMIT);
}

export const companyNameContains = (term: string): Specification<Customer> =>
    (query) => query.where(CustomerFields.companyName, 'LIKE', `%${term}%`);

export const orderedByCompanyName = (): Specification<Customer> =>
    (query) => query.orderByAsc(CustomerFields.companyName);

export const firstPage = (limit: number): Specification<Customer> =>
    (query) => query.page(1, limit);

export function toCustomerSummary(customer: Customer): CustomerSummary {
    return { id: customer.id, companyName: customer.companyName, email: customer.email ?? null };
}

export function listCustomers(db: CustomerContext, request: CustomerListRequest): CustomerListResponse {
    const limit = clampCustomerLimit(request.limit);
    const search = (request.search ?? '').trim();

    const specifications: Specification<Customer>[] = [];
    if (search) specifications.push(companyNameContains(search));
    specifications.push(orderedByCompanyName(), firstPage(limit));

    const customers = db.customers.list(...specifications).map(toCustomerSummary);
    return { customers, limit };
}
