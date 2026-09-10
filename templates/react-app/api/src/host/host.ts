/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

import type { EntryPoints } from 'N/types';

/** Attached to the Suitelet form: gives the page a viewport meta tag so the SPA lays out responsively. */
export const pageInit: EntryPoints.Client.pageInit = (_context: EntryPoints.Client.pageInitContext): void => {
    const viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = 'width=device-width, initial-scale=1.0';
    document.head.appendChild(viewportMeta);
};
