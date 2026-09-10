/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

import type { EntryPoints } from 'N/types';
import * as log from 'N/log';
import * as serverWidget from 'N/ui/serverWidget';
import { app } from 'common/netsuite';
import { getFileUrlByName } from '../lib/fileCabinet';

/**
 * Serves the single-page app: a NetSuite form (so the session, roles and navigation apply)
 * with one inline HTML field that mounts the React bundle from the File Cabinet.
 */

function buildHostMarkup(bundleUrl: string): string {
    const rootId = app.rootElementId;
    return `<style>
  /* The form's own chrome makes the host document taller than the viewport. The SPA scrolls
     internally, so the host page must never grow a second, window-level scrollbar. */
  html, body { overflow: hidden !important; }
</style>
<div id="${rootId}" style="width: 100%; max-width: 100%; overflow: hidden; box-sizing: border-box;"></div>
<script>
(function () {
  var rootElement = document.getElementById('${rootId}');
  if (!rootElement) return;
  var container = rootElement.closest('.uir-page-title-secondline, #div__body, [id*="div_"], td');
  if (container) {
    var containerWidth = container.offsetWidth || container.clientWidth;
    if (containerWidth > 0) {
      rootElement.style.width = containerWidth + 'px';
      rootElement.style.maxWidth = containerWidth + 'px';
    }
  }
  // The window-level scrollbar comes from whichever NetSuite wrapper happens to scroll, not
  // necessarily body. Clamp every ancestor; all scrolling lives inside the root element.
  for (var ancestor = rootElement.parentElement; ancestor; ancestor = ancestor.parentElement) {
    ancestor.style.setProperty('overflow', 'hidden', 'important');
  }
})();
</script>
<script src="${bundleUrl}?v=${__APP_VERSION__}-${__BUILD_ID__}"></script>`;
}

export const onRequest = (context: EntryPoints.Suitelet.onRequestContext): void => {
    const form = serverWidget.createForm({ title: app.title, hideNavBar: true });
    form.clientScriptModulePath = app.fileCabinet.hostScriptPath;

    try {
        const bundleUrl = getFileUrlByName({
            parentFolderName: app.fileCabinet.folder,
            folderName: app.fileCabinet.clientFolder,
            fileName: app.fileCabinet.clientBundle,
        });
        if (!bundleUrl) {
            log.error('home: bundle not found', app.fileCabinet);
            form.addField({
                id: 'custpage_error',
                type: serverWidget.FieldType.LABEL,
                label: `The client bundle ${app.fileCabinet.folder}/${app.fileCabinet.clientFolder}/${app.fileCabinet.clientBundle} is not in the File Cabinet. Run npm run deploy.`,
            });
        } else {
            const htmlField = form.addField({
                id: 'custpage_react_app',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Application',
            });
            htmlField.defaultValue = buildHostMarkup(bundleUrl);
            log.audit('home: serving bundle', { bundleUrl, version: __APP_VERSION__, buildId: __BUILD_ID__ });
        }
    } catch (error) {
        log.error('home: failed to build the page', error instanceof Error ? error.message : String(error));
    }

    context.response.writePage(form);
};
