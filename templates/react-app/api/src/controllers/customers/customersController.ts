/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

// @netsuite-project:example — scaffold example. Replace it with your own controller
// (npm run add:controller -- <name>) or delete it; npm run deploy refuses to upload files carrying this marker.
//
// The only transport-specific file of this controller. To serve the same endpoints from a Suitelet:
//   1. change @NScriptType above to Suitelet,
//   2. replace the body with `export const onRequest = defineSuitelet('customers', customersEndpoints);`
//      (import from '../../lib/defineSuitelet'),
//   3. switch the SDF object in netsuite/Objects to a <suitelet>,
//   4. set `kind: 'suitelet'` on scripts.customers in common/netsuite.ts.

import { defineRestlet } from '../../lib/defineRestlet';
import { customersEndpoints } from './endpoints';

const restlet = defineRestlet('customers', customersEndpoints);

export const get = restlet.get;
