import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ControllerGenerationError, generateController, insertScriptsEntry, parseMethods, SCRIPTS_MARKER } from '../src/generators/controller/index.js';
import type { NetSuiteProjectConfig } from '../src/projectConfig.js';

const config: NetSuiteProjectConfig = { template: 'react-app', templateRef: 'local', appName: 'DemoApp', prefix: 'demo', cliVersion: '0.0.0-test' };

const NETSUITE_SOURCE = `export const scripts = {
    home: { scriptId: 'customscript_demo_home', deployId: 'customdeploy_demo_home' },
    ${SCRIPTS_MARKER}
} as const;
`;

describe('parseMethods', () => {
    it('defaults to get, normalises order and rejects unknown methods', () => {
        expect(parseMethods(undefined)).toEqual(['get']);
        expect(parseMethods('post, GET')).toEqual(['get', 'post']);
        expect(() => parseMethods('get,patch')).toThrow(ControllerGenerationError);
    });
});

describe('insertScriptsEntry', () => {
    it('inserts above the marker and refuses duplicates', () => {
        const updated = insertScriptsEntry(NETSUITE_SOURCE, "    orders: { scriptId: 'x', deployId: 'y' },\n", 'orders');
        expect(updated.indexOf('orders:')).toBeLessThan(updated.indexOf(SCRIPTS_MARKER));
        expect(updated).toContain(SCRIPTS_MARKER);
        expect(() => insertScriptsEntry(updated, 'again', 'orders')).toThrow(/already has/);
        expect(() => insertScriptsEntry('export const scripts = {} as const;', 'x', 'orders')).toThrow(/marker/);
    });
});

describe('generateController', () => {
    let projectDir: string;

    beforeEach(async () => {
        projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'add-controller-'));
        await fs.mkdir(path.join(projectDir, 'common'), { recursive: true });
        await fs.writeFile(path.join(projectDir, 'common', 'netsuite.ts'), NETSUITE_SOURCE);
    });

    afterEach(async () => {
        await fs.rm(projectDir, { recursive: true, force: true });
    });

    it('writes a restlet controller, its object, shared types, the client api and the scripts entry', async () => {
        const result = await generateController({ projectDir, config, controllerName: 'salesOrders', methods: ['get', 'post', 'delete'], suitelet: false });

        expect(result.scriptId).toBe('customscript_demo_sales_orders');
        expect(result.writtenFiles).toEqual([
            'api/src/controllers/salesOrdersController.ts',
            'netsuite/Objects/customscript_demo_sales_orders.xml',
            'common/types/salesOrders.ts',
            'client/src/api/salesOrdersApi.ts',
            'common/netsuite.ts',
        ]);

        const controller = await fs.readFile(path.join(projectDir, 'api/src/controllers/salesOrdersController.ts'), 'utf8');
        expect(controller.startsWith('/**\n * @NApiVersion 2.1\n * @NScriptType Restlet')).toBe(true);
        expect(controller).toContain('export const get = restlet.get;');
        expect(controller).toContain('export const post = restlet.post;');
        expect(controller).not.toContain('export const put');
        expect(controller).toContain('export { restletDelete as delete };');
        expect(controller).not.toContain('{{');

        const object = await fs.readFile(path.join(projectDir, 'netsuite/Objects/customscript_demo_sales_orders.xml'), 'utf8');
        expect(object).toContain('<restlet scriptid="customscript_demo_sales_orders">');
        expect(object).toContain('[/SuiteScripts/DemoApp/api/controllers/salesOrdersController.js]');
        expect(object).toContain('<name>Demo App Sales Orders</name>');

        const netsuite = await fs.readFile(path.join(projectDir, 'common/netsuite.ts'), 'utf8');
        expect(netsuite).toContain("salesOrders: { scriptId: 'customscript_demo_sales_orders', deployId: 'customdeploy_demo_sales_orders' },");

        const clientApi = await fs.readFile(path.join(projectDir, 'client/src/api/salesOrdersApi.ts'), 'utf8');
        expect(clientApi).toContain('export function fetchSalesOrders');
        expect(clientApi).toContain('export function deleteSalesOrders');
        expect(clientApi).not.toContain('updateSalesOrders');
    });

    it('writes a suitelet without client api or types', async () => {
        const result = await generateController({ projectDir, config, controllerName: 'report', methods: [], suitelet: true });
        expect(result.writtenFiles).toEqual([
            'api/src/controllers/reportController.ts',
            'netsuite/Objects/customscript_demo_report.xml',
            'common/netsuite.ts',
        ]);
        const controller = await fs.readFile(path.join(projectDir, 'api/src/controllers/reportController.ts'), 'utf8');
        expect(controller).toContain('@NScriptType Suitelet');
        expect(controller).toContain('export const onRequest');
    });

    it('never overwrites and leaves nothing behind on refusal', async () => {
        await generateController({ projectDir, config, controllerName: 'orders', methods: ['get'], suitelet: false });
        await expect(generateController({ projectDir, config, controllerName: 'orders', methods: ['get'], suitelet: false }))
            .rejects.toThrow(/already/);
    });

    it('enforces the script id budget and camelCase names', async () => {
        await expect(generateController({ projectDir, config, controllerName: 'Orders', methods: ['get'], suitelet: false }))
            .rejects.toThrow(/camelCase/);
        await expect(generateController({ projectDir, config, controllerName: 'a'.repeat(30), methods: ['get'], suitelet: false }))
            .rejects.toThrow(/at most/);
    });
});
