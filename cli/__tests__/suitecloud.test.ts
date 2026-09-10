import { describe, expect, it } from 'vitest';
import { parseManageAuthList } from '../src/steps/suitecloud.js';

describe('parseManageAuthList', () => {
    it('parses the pipe-separated lines and strips the ANSI prefix on the first one', () => {
        const output = [
            '[2K[1Gproduction_id | Administrator @ Example Company ',
            'sandbox_id | Administrator @ Example Company | 1234567-sb1.app.netsuite.com',
            '',
            'Some trailing message without pipes',
        ].join('\n');

        expect(parseManageAuthList(output)).toEqual([
            { authId: 'production_id', roleAndCompany: 'Administrator @ Example Company', host: undefined },
            { authId: 'sandbox_id', roleAndCompany: 'Administrator @ Example Company', host: '1234567-sb1.app.netsuite.com' },
        ]);
    });

    it('returns nothing for output with no auth ids', () => {
        expect(parseManageAuthList('No authentication IDs have been set up.\n')).toEqual([]);
    });
});
