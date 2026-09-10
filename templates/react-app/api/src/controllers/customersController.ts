/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import type { CustomerListRequest } from 'common/types/customers';
import { listCustomers } from '../domain/customers';
import { defineRestlet } from '../lib/defineRestlet';
import { createAppContext } from '../models/generated/context.gen';

const restlet = defineRestlet('customers', {
    get: (request: CustomerListRequest) => listCustomers(createAppContext({ tracking: false }), request),
});

export const get = restlet.get;
