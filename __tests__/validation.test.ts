import { describe, expect, it } from 'vitest';
import {
    buildDeployId,
    buildScriptId,
    isValidNpmPackageName,
    remainingObjectNameBudget,
    SCRIPT_ID_MAX_LENGTH,
    validateObjectName,
    validatePrefix,
    validateProjectName,
} from '../src/validation.js';

describe('validateProjectName', () => {
    it('accepts PascalCase and kebab-case names', () => {
        expect(validateProjectName('MyApp')).toBeUndefined();
        expect(validateProjectName('my-app-2')).toBeUndefined();
    });

    it('rejects names that are too short, too long or badly formed', () => {
        expect(validateProjectName('')).toMatch(/required/);
        expect(validateProjectName('A')).toMatch(/at least/);
        expect(validateProjectName('A'.repeat(41))).toMatch(/at most/);
        expect(validateProjectName('1app')).toMatch(/start with a letter/);
        expect(validateProjectName('my_app')).toMatch(/letters, digits and hyphens/);
    });
});

describe('validatePrefix', () => {
    it('accepts 2-10 lowercase alphanumerics starting with a letter', () => {
        expect(validatePrefix('ab')).toBeUndefined();
        expect(validatePrefix('demo123')).toBeUndefined();
        expect(validatePrefix('a123456789')).toBeUndefined();
    });

    it('rejects underscores, uppercase, digits first and wrong lengths', () => {
        expect(validatePrefix('a')).toBeDefined();
        expect(validatePrefix('a1234567890')).toBeDefined();
        expect(validatePrefix('my_app')).toBeDefined();
        expect(validatePrefix('Demo')).toBeDefined();
        expect(validatePrefix('1demo')).toBeDefined();
    });
});

describe('script id budget', () => {
    it('keeps customscript_<prefix>_<name> at or under 40 characters', () => {
        const prefix = 'demo';
        const budget = remainingObjectNameBudget(prefix);
        const longestName = 'a'.repeat(budget);
        expect(validateObjectName(longestName, prefix)).toBeUndefined();
        expect(buildScriptId(prefix, longestName)).toHaveLength(SCRIPT_ID_MAX_LENGTH);
        expect(buildDeployId(prefix, longestName)).toHaveLength(SCRIPT_ID_MAX_LENGTH);
        expect(validateObjectName(`${longestName}a`, prefix)).toMatch(/at most/);
    });

    it('shrinks the name budget as the prefix grows', () => {
        expect(remainingObjectNameBudget('ab')).toBe(24);
        expect(remainingObjectNameBudget('a123456789')).toBe(16);
    });

    it('rejects object names with uppercase or leading digits', () => {
        expect(validateObjectName('Orders', 'demo')).toBeDefined();
        expect(validateObjectName('1orders', 'demo')).toBeDefined();
        expect(validateObjectName('sales_orders', 'demo')).toBeUndefined();
    });
});

describe('isValidNpmPackageName', () => {
    it('accepts kebab-case names and rejects npm-illegal ones', () => {
        expect(isValidNpmPackageName('my-app')).toBe(true);
        expect(isValidNpmPackageName('MyApp')).toBe(false);
        expect(isValidNpmPackageName('_private')).toBe(false);
        expect(isValidNpmPackageName('a b')).toBe(false);
    });
});
