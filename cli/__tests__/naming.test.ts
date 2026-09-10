import { describe, expect, it } from 'vitest';
import { defaultPrefixForProjectName, toCamelCase, toKebabCase, toPascalCase, toSnakeCase, toTitleCase } from '../src/naming.js';

describe('case conversions', () => {
    it('converts between PascalCase, kebab-case, snake_case and Title Case', () => {
        expect(toPascalCase('my-app')).toBe('MyApp');
        expect(toPascalCase('myApp')).toBe('MyApp');
        expect(toPascalCase('MyApp')).toBe('MyApp');
        expect(toKebabCase('MyApp')).toBe('my-app');
        expect(toKebabCase('MyAPIApp')).toBe('my-api-app');
        expect(toKebabCase('my-app')).toBe('my-app');
        expect(toSnakeCase('salesOrders')).toBe('sales_orders');
        expect(toCamelCase('sales-orders')).toBe('salesOrders');
        expect(toTitleCase('AccountingHub')).toBe('Accounting Hub');
        expect(toTitleCase('my-api-app')).toBe('My Api App');
    });
});

describe('defaultPrefixForProjectName', () => {
    it('lowercases, strips separators and truncates to 8', () => {
        expect(defaultPrefixForProjectName('AccountingHub')).toBe('accounti');
        expect(defaultPrefixForProjectName('My-App')).toBe('myapp');
    });

    it('is never shorter than two characters and always starts with a letter', () => {
        expect(defaultPrefixForProjectName('A')).toBe('aapp');
        expect(defaultPrefixForProjectName('9lives')).toBe('a9lives');
    });
});
