import { defineEndpoints } from '../../../lib/endpoint';
import { getCustomers } from './getCustomers';

/** One entry per HTTP method; each endpoint lives in its own file next to this one. */
export const customersEndpoints = defineEndpoints({
    get: getCustomers,
});
