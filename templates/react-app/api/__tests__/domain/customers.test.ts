import { describe, expect, it, vi } from 'vitest';
import {
    clampCustomerLimit,
    DEFAULT_CUSTOMER_LIMIT,
    listCustomers,
    MAX_CUSTOMER_LIMIT,
    type CustomerContext,
} from '../../src/domain/customers';
import type { Customer } from '../../src/models/generated/Customer.gen';

/** Records the query builder calls a specification makes, so a test can assert on them. */
function createRecordingQuery() {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ['where', 'orderByAsc', 'orderByDesc', 'page']) {
        query[method] = (...args: unknown[]) => {
            calls.push({ method, args });
            return query;
        };
    }
    return { query, calls };
}

function createFakeContext(rows: Customer[]) {
    const recording = createRecordingQuery();
    const list = vi.fn((...specifications: Array<(query: unknown) => unknown>) => {
        specifications.forEach((specification) => specification(recording.query));
        return rows;
    });
    const db = { customers: { list } } as unknown as CustomerContext;
    return { db, list, calls: recording.calls };
}

describe('clampCustomerLimit', () => {
    it('falls back to the default for missing or invalid values', () => {
        expect(clampCustomerLimit(undefined)).toBe(DEFAULT_CUSTOMER_LIMIT);
        expect(clampCustomerLimit('abc')).toBe(DEFAULT_CUSTOMER_LIMIT);
        expect(clampCustomerLimit(0)).toBe(DEFAULT_CUSTOMER_LIMIT);
    });

    it('parses strings and caps at the maximum', () => {
        expect(clampCustomerLimit('25')).toBe(25);
        expect(clampCustomerLimit(10_000)).toBe(MAX_CUSTOMER_LIMIT);
    });
});

describe('listCustomers', () => {
    const rows: Customer[] = [
        { id: 1, companyName: 'Acme', email: 'hello@acme.example' },
        { id: 2, companyName: 'Beta', email: null },
    ];

    it('maps rows to summaries and reports the applied limit', () => {
        const { db } = createFakeContext(rows);
        expect(listCustomers(db, {})).toEqual({
            customers: [
                { id: 1, companyName: 'Acme', email: 'hello@acme.example' },
                { id: 2, companyName: 'Beta', email: null },
            ],
            limit: DEFAULT_CUSTOMER_LIMIT,
        });
    });

    it('adds a company-name filter only when a search term is given', () => {
        const { db, calls } = createFakeContext(rows);
        listCustomers(db, { search: '  acme ', limit: '5' });
        expect(calls).toEqual([
            { method: 'where', args: ['companyName', 'LIKE', '%acme%'] },
            { method: 'orderByAsc', args: ['companyName'] },
            { method: 'page', args: [1, 5] },
        ]);
    });

    it('skips the filter for a blank search', () => {
        const { db, calls } = createFakeContext(rows);
        listCustomers(db, { search: '   ' });
        expect(calls.map((call) => call.method)).toEqual(['orderByAsc', 'page']);
    });
});
