/**
 * Source templates for `add controller`, keyed by project type and rendered with the same
 * `{{token}}` / `{{#if flag}}` language as the project templates. Kept as strings so the
 * published package is a single bundled file.
 *
 * Tokens: controllerName (camel), ControllerName (Pascal), controllerTitle, objectName (snake),
 * prefix, appName, appTitle, scriptKind, and the per-endpoint lists the generator builds
 * (endpointImports, endpointNames, contractEntries, endpointTypeEntries, sharedTypeDeclarations).
 * The endpoint template also gets endpointName, EndpointName and METHOD.
 * Flags: hasGet, hasPost, hasPut, hasDelete, isSuitelet.
 */

export interface ControllerTemplateSet {
    /** The transport-specific entry file; `isSuitelet` picks Restlet or Suitelet. */
    controller: string;
    endpointsIndex: string;
    /** One file per endpoint, rendered with that endpoint's tokens. */
    endpoint: string;
    restletObject: string;
    suiteletObject: string;
    clientApi: string;
    sharedTypes: string;
    scriptsEntry: string;
}

const REACT_APP_CONTROLLER = String.raw`/**
 * @NApiVersion 2.1
{{#if isSuitelet}}
 * @NScriptType Suitelet
{{/if}}
{{#unless isSuitelet}}
 * @NScriptType Restlet
{{/unless}}
 * @NModuleScope SameAccount
 */

// The only transport-specific file of this controller. The endpoints under ./endpoints do not know
// whether a Restlet or a Suitelet serves them; to switch, change @NScriptType above, swap
// defineRestlet/defineSuitelet below, replace the SDF object in netsuite/Objects, and update
// scripts.{{controllerName}}.kind in common/netsuite.ts.

{{#if isSuitelet}}
import { defineSuitelet } from '../../lib/defineSuitelet';
import { {{controllerName}}Endpoints } from './endpoints';

export const onRequest = defineSuitelet('{{controllerName}}', {{controllerName}}Endpoints);
{{/if}}
{{#unless isSuitelet}}
import { defineRestlet } from '../../lib/defineRestlet';
import { {{controllerName}}Endpoints } from './endpoints';

// A Restlet exports only the HTTP methods its endpoints use; an endpoint with a new method adds its export.
const restlet = defineRestlet('{{controllerName}}', {{controllerName}}Endpoints);

{{#if hasGet}}
export const get = restlet.get;
{{/if}}
{{#if hasPost}}
export const post = restlet.post;
{{/if}}
{{#if hasPut}}
export const put = restlet.put;
{{/if}}
{{#if hasDelete}}
const restletDelete = restlet.delete;
export { restletDelete as delete };
{{/if}}
{{/unless}}
`;

const REACT_APP_ENDPOINTS_INDEX = String.raw`import { {{controllerName}}Contract } from 'common/types/{{controllerName}}';
import { defineEndpoints } from '../../../lib/endpoint';
{{endpointImports}}

/** The controller's endpoints by name, each in its own file next to this one; the contract in common/ gives each its method. */
export const {{controllerName}}Endpoints = defineEndpoints({{controllerName}}Contract, { {{endpointNames}} });
`;

const REACT_APP_ENDPOINT = String.raw`import type { {{ControllerName}}{{EndpointName}}Request, {{ControllerName}}{{EndpointName}}Response } from 'common/types/{{controllerName}}';
import type { Endpoint } from '../../../lib/endpoint';

// Endpoints stay thin: call a service, return its result. See controllers/customers/endpoints/list.ts.

/** {{METHOD}} ?endpoint={{endpointName}} */
export const {{endpointName}}: Endpoint<{{ControllerName}}{{EndpointName}}Request, {{ControllerName}}{{EndpointName}}Response> = (request) => ({
    message: '{{endpointName}} on {{controllerName}} is not implemented yet',
    request,
});
`;

const REACT_APP_RESTLET_OBJECT = String.raw`<restlet scriptid="customscript_{{prefix}}_{{objectName}}">
  <description></description>
  <isinactive>F</isinactive>
  <name>{{appTitle}} {{controllerTitle}}</name>
  <notifyadmins>F</notifyadmins>
  <notifyemails></notifyemails>
  <notifyowner>T</notifyowner>
  <notifyuser>F</notifyuser>
  <scriptfile>[/SuiteScripts/{{appName}}/api/controllers/{{controllerName}}/{{controllerName}}Controller.js]</scriptfile>
  <scriptdeployments>
    <scriptdeployment scriptid="customdeploy_{{prefix}}_{{objectName}}">
      <allemployees>F</allemployees>
      <allpartners>F</allpartners>
      <allroles>F</allroles>
      <audslctrole>ADMINISTRATOR</audslctrole>
      <isdeployed>T</isdeployed>
      <loglevel>DEBUG</loglevel>
      <status>RELEASED</status>
      <title>{{appTitle}} {{controllerTitle}}</title>
    </scriptdeployment>
  </scriptdeployments>
</restlet>
`;

const REACT_APP_SUITELET_OBJECT = String.raw`<suitelet scriptid="customscript_{{prefix}}_{{objectName}}">
  <description></description>
  <isinactive>F</isinactive>
  <name>{{appTitle}} {{controllerTitle}}</name>
  <notifyadmins>F</notifyadmins>
  <notifyemails></notifyemails>
  <notifyowner>T</notifyowner>
  <notifyuser>F</notifyuser>
  <scriptfile>[/SuiteScripts/{{appName}}/api/controllers/{{controllerName}}/{{controllerName}}Controller.js]</scriptfile>
  <scriptdeployments>
    <scriptdeployment scriptid="customdeploy_{{prefix}}_{{objectName}}">
      <allemployees>F</allemployees>
      <allpartners>F</allpartners>
      <allroles>F</allroles>
      <audslctrole>ADMINISTRATOR</audslctrole>
      <eventtype></eventtype>
      <isdeployed>T</isdeployed>
      <isonline>F</isonline>
      <loglevel>DEBUG</loglevel>
      <runasrole></runasrole>
      <status>RELEASED</status>
      <title>{{appTitle}} {{controllerTitle}}</title>
    </scriptdeployment>
  </scriptdeployments>
</suitelet>
`;

const REACT_APP_CLIENT_API = String.raw`import { scripts } from 'common/netsuite';
import { {{controllerName}}Contract } from 'common/types/{{controllerName}}';
import { createApiClient } from './apiClient';

/** One typed function per endpoint of the {{controllerName}} controller: {{controllerName}}Api.<endpoint>(request). */
export const {{controllerName}}Api = createApiClient(scripts.{{controllerName}}, {{controllerName}}Contract);
`;

const REACT_APP_SHARED_TYPES = String.raw`// Request and response shapes of the {{controllerName}} controller and its endpoint contract. Shared by api/ and client/.
import { defineContract } from './api';

{{sharedTypeDeclarations}}
/** The request and response of each endpoint of the {{controllerName}} controller. */
export interface {{ControllerName}}Endpoints {
{{endpointTypeEntries}}
}

/** The {{controllerName}} controller's endpoints by name and method, for defineEndpoints on the server and createApiClient on the client. */
export const {{controllerName}}Contract = defineContract<{{ControllerName}}Endpoints>({
{{contractEntries}}
});
`;

const REACT_APP_SCRIPTS_ENTRY = String.raw`    {{controllerName}}: { kind: '{{scriptKind}}', scriptId: 'customscript_{{prefix}}_{{objectName}}', deployId: 'customdeploy_{{prefix}}_{{objectName}}' },
`;

export const CONTROLLER_TEMPLATES: Record<string, ControllerTemplateSet> = {
    'react-app': {
        controller: REACT_APP_CONTROLLER,
        endpointsIndex: REACT_APP_ENDPOINTS_INDEX,
        endpoint: REACT_APP_ENDPOINT,
        restletObject: REACT_APP_RESTLET_OBJECT,
        suiteletObject: REACT_APP_SUITELET_OBJECT,
        clientApi: REACT_APP_CLIENT_API,
        sharedTypes: REACT_APP_SHARED_TYPES,
        scriptsEntry: REACT_APP_SCRIPTS_ENTRY,
    },
};
