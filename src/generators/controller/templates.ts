/**
 * Source templates for `add controller`, keyed by project type and rendered with the same
 * `{{token}}` / `{{#if flag}}` language as the project templates. Kept as strings so the
 * published package is a single bundled file.
 *
 * Tokens: controllerName (camel), ControllerName (Pascal), controllerTitle, objectName (snake),
 * prefix, appName, appTitle, scriptKind. Flags: hasGet, hasPost, hasPut, hasDelete, isSuitelet.
 */

export interface ControllerTemplateSet {
    /** The transport-specific entry file; `isSuitelet` picks Restlet or Suitelet. */
    controller: string;
    endpointsIndex: string;
    endpoint: Record<'get' | 'post' | 'put' | 'delete', string>;
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

const REACT_APP_ENDPOINTS_INDEX = String.raw`import { defineEndpoints } from '../../../lib/endpoint';
{{#if hasGet}}
import { get{{ControllerName}} } from './get{{ControllerName}}';
{{/if}}
{{#if hasPost}}
import { post{{ControllerName}} } from './post{{ControllerName}}';
{{/if}}
{{#if hasPut}}
import { put{{ControllerName}} } from './put{{ControllerName}}';
{{/if}}
{{#if hasDelete}}
import { delete{{ControllerName}} } from './delete{{ControllerName}}';
{{/if}}

/** One entry per HTTP method; each endpoint lives in its own file next to this one. */
export const {{controllerName}}Endpoints = defineEndpoints({
{{#if hasGet}}
    get: get{{ControllerName}},
{{/if}}
{{#if hasPost}}
    post: post{{ControllerName}},
{{/if}}
{{#if hasPut}}
    put: put{{ControllerName}},
{{/if}}
{{#if hasDelete}}
    delete: delete{{ControllerName}},
{{/if}}
});
`;

function endpointTemplate(verb: 'get' | 'post' | 'put' | 'delete'): string {
    const Verb = verb.charAt(0).toUpperCase() + verb.slice(1);
    const METHOD = verb.toUpperCase();
    return String.raw`import type { {{ControllerName}}${Verb}Request, {{ControllerName}}${Verb}Response } from 'common/types/{{controllerName}}';
import type { Endpoint } from '../../../lib/endpoint';

// Typed data access lives in the generated context; see controllers/customers/endpoints/getCustomers.ts:
// import { createAppContext } from '../../../models/generated/context.gen';

/** ${METHOD} {{controllerName}} */
export const ${verb}{{ControllerName}}: Endpoint<{{ControllerName}}${Verb}Request, {{ControllerName}}${Verb}Response> = (request) => ({
    message: '${METHOD} {{controllerName}} is not implemented yet',
    request,
});
`;
}

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

const REACT_APP_CLIENT_API = String.raw`import type {
{{#if hasGet}}
    {{ControllerName}}GetRequest,
    {{ControllerName}}GetResponse,
{{/if}}
{{#if hasPost}}
    {{ControllerName}}PostRequest,
    {{ControllerName}}PostResponse,
{{/if}}
{{#if hasPut}}
    {{ControllerName}}PutRequest,
    {{ControllerName}}PutResponse,
{{/if}}
{{#if hasDelete}}
    {{ControllerName}}DeleteRequest,
    {{ControllerName}}DeleteResponse,
{{/if}}
} from 'common/types/{{controllerName}}';
import { scripts } from 'common/netsuite';
import { callEndpoint } from './apiClient';

{{#if hasGet}}
export function fetch{{ControllerName}}(request: {{ControllerName}}GetRequest = {}): Promise<{{ControllerName}}GetResponse> {
    return callEndpoint<{{ControllerName}}GetResponse>(scripts.{{controllerName}}, 'GET', { query: request });
}

{{/if}}
{{#if hasPost}}
export function create{{ControllerName}}(request: {{ControllerName}}PostRequest): Promise<{{ControllerName}}PostResponse> {
    return callEndpoint<{{ControllerName}}PostResponse>(scripts.{{controllerName}}, 'POST', { body: request });
}

{{/if}}
{{#if hasPut}}
export function update{{ControllerName}}(request: {{ControllerName}}PutRequest): Promise<{{ControllerName}}PutResponse> {
    return callEndpoint<{{ControllerName}}PutResponse>(scripts.{{controllerName}}, 'PUT', { body: request });
}

{{/if}}
{{#if hasDelete}}
export function delete{{ControllerName}}(request: {{ControllerName}}DeleteRequest): Promise<{{ControllerName}}DeleteResponse> {
    return callEndpoint<{{ControllerName}}DeleteResponse>(scripts.{{controllerName}}, 'DELETE', { body: request });
}

{{/if}}
`;

const REACT_APP_SHARED_TYPES = String.raw`// Request and response shapes for the {{controllerName}} controller. Shared by api/ and client/.

{{#if hasGet}}
export interface {{ControllerName}}GetRequest {
    [parameter: string]: string | undefined;
}

export interface {{ControllerName}}GetResponse {
    message: string;
    request: {{ControllerName}}GetRequest;
}

{{/if}}
{{#if hasPost}}
export interface {{ControllerName}}PostRequest {
    [field: string]: unknown;
}

export interface {{ControllerName}}PostResponse {
    message: string;
    request: {{ControllerName}}PostRequest;
}

{{/if}}
{{#if hasPut}}
export interface {{ControllerName}}PutRequest {
    [field: string]: unknown;
}

export interface {{ControllerName}}PutResponse {
    message: string;
    request: {{ControllerName}}PutRequest;
}

{{/if}}
{{#if hasDelete}}
export interface {{ControllerName}}DeleteRequest {
    [field: string]: unknown;
}

export interface {{ControllerName}}DeleteResponse {
    message: string;
    request: {{ControllerName}}DeleteRequest;
}

{{/if}}
`;

const REACT_APP_SCRIPTS_ENTRY = String.raw`    {{controllerName}}: { kind: '{{scriptKind}}', scriptId: 'customscript_{{prefix}}_{{objectName}}', deployId: 'customdeploy_{{prefix}}_{{objectName}}' },
`;

export const CONTROLLER_TEMPLATES: Record<string, ControllerTemplateSet> = {
    'react-app': {
        controller: REACT_APP_CONTROLLER,
        endpointsIndex: REACT_APP_ENDPOINTS_INDEX,
        endpoint: {
            get: endpointTemplate('get'),
            post: endpointTemplate('post'),
            put: endpointTemplate('put'),
            delete: endpointTemplate('delete'),
        },
        restletObject: REACT_APP_RESTLET_OBJECT,
        suiteletObject: REACT_APP_SUITELET_OBJECT,
        clientApi: REACT_APP_CLIENT_API,
        sharedTypes: REACT_APP_SHARED_TYPES,
        scriptsEntry: REACT_APP_SCRIPTS_ENTRY,
    },
};
