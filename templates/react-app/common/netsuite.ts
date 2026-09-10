// Single home for NetSuite magic strings. No N/* imports: the client bundles this file too.
//
// Group identifiers by the party that owns them (NetSuite itself, then each third party),
// so a rename or an integration swap touches one block.

export const app = {
    name: '{{appName}}',
    title: '{{appTitle}}',
    prefix: '{{prefix}}',
    fileCabinet: {
        /** Top-level folder under /SuiteScripts holding both bundles. */
        folder: '{{appName}}',
        clientFolder: 'client',
        clientBundle: 'app.js',
        /** Module path of the client script attached to the Suitelet form. */
        hostScriptPath: '/SuiteScripts/{{appName}}/api/host/host.js',
    },
    rootElementId: 'react-root',
} as const;

/** Standard NetSuite record types and field ids used by this application. */
export const netsuite = {
    records: {
        customer: 'customer',
    },
    fields: {
        customer: {
            id: 'id',
            companyName: 'companyname',
            email: 'email',
            // Custom fields follow the same pattern: exampleFlag: 'custentity_{{prefix}}_example',
        },
    },
} as const;

/** SPS Commerce identifiers (example third-party group; fill in or delete). */
export const sps = {} as const;

/** Avalara identifiers (example third-party group; fill in or delete). */
export const avalara = {} as const;

/** How a script is reached over HTTP; the client builds the URL from it. */
export type ScriptKind = 'restlet' | 'suitelet';

export interface ScriptRef {
    kind: ScriptKind;
    scriptId: string;
    deployId: string;
}

/**
 * Every script this application deploys. The client calls API controllers through these entries;
 * `kind` must match the controller's @NScriptType and its SDF object.
 */
export const scripts = {
    home: { kind: 'suitelet', scriptId: 'customscript_{{prefix}}_home', deployId: 'customdeploy_{{prefix}}_home' },
    customers: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_customers', deployId: 'customdeploy_{{prefix}}_customers' },
    // @netsuite-project:scripts
} as const satisfies Record<string, ScriptRef>;
