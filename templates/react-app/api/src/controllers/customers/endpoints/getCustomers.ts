import type { CustomerListRequest, CustomerListResponse } from 'common/types/customers';
import { listCustomers } from '../../../domain/customers';
import type { Endpoint } from '../../../lib/endpoint';
import { createAppContext } from '../../../models/generated/context.gen';

// @netsuite-project:example — scaffold example; see customersController.ts.

/** GET customers?search=&limit= — wires the request to the domain function with a fresh context. */
export const getCustomers: Endpoint<CustomerListRequest, CustomerListResponse> = (request) =>
    listCustomers(createAppContext({ tracking: false }), request);
