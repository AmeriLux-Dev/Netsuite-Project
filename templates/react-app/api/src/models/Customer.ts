import { Field, ReadOnly, RecordType } from '@amerilux/netsuite-repository';
import { netsuite } from '../../../common/netsuite';

/**
 * The customer record, as much of it as this application reads. Every declared property
 * is a mapped field; `@Field` only where the property name differs from the field id.
 * Run `npm run generate` after editing to refresh src/models/generated/.
 */
@RecordType(netsuite.records.customer)
export class Customer {
    @ReadOnly() id!: number;
    @Field(netsuite.fields.customer.companyName) companyName!: string;
    @Field(netsuite.fields.customer.email) email!: string | null;
}
