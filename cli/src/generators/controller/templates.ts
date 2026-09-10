/**
 * Source templates for `add controller`, keyed by project type and rendered with the same
 * `{{token}}` / `{{#if flag}}` language as the project templates. Kept as strings so the
 * published package is a single bundled file.
 *
 * Tokens: controllerName (camel), ControllerName (Pascal), controllerTitle, objectName (snake),
 * prefix, appName, appTitle. Flags: hasGet, hasPost, hasPut, hasDelete.
 */

export interface ControllerTemplateSet {
    restletController: string;
    suiteletController: string;
    restletObject: string;
    suiteletObject: string;
    clientApi: string;
    sharedTypes: string;
    scriptsEntry: string;
}

const REACT_APP_RESTLET_CONTROLLER = String.raw`/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import type {
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
import { defineRestlet } from '../lib/defineRestlet';

// Typed data access lives in the generated context; see api/src/domain/customers.ts for the pattern:
// import { createAppContext } from '../models/generated/context.gen';

{{#if hasGet}}
function get{{ControllerName}}(request: {{ControllerName}}GetRequest): {{ControllerName}}GetResponse {
    return { message: 'GET {{controllerName}} is not implemented yet', request };
}

{{/if}}
{{#if hasPost}}
function post{{ControllerName}}(request: {{ControllerName}}PostRequest): {{ControllerName}}PostResponse {
    return { message: 'POST {{controllerName}} is not implemented yet', request };
}

{{/if}}
{{#if hasPut}}
function put{{ControllerName}}(request: {{ControllerName}}PutRequest): {{ControllerName}}PutResponse {
    return { message: 'PUT {{controllerName}} is not implemented yet', request };
}

{{/if}}
{{#if hasDelete}}
function delete{{ControllerName}}(request: {{ControllerName}}DeleteRequest): {{ControllerName}}DeleteResponse {
    return { message: 'DELETE {{controllerName}} is not implemented yet', request };
}

{{/if}}
const restlet = defineRestlet('{{controllerName}}', {
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
`;

const REACT_APP_SUITELET_CONTROLLER = String.raw`/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

import type { EntryPoints } from 'N/types';
import * as log from 'N/log';
import * as serverWidget from 'N/ui/serverWidget';
import { app } from 'common/netsuite';

export const onRequest = (context: EntryPoints.Suitelet.onRequestContext): void => {
    const form = serverWidget.createForm({ title: app.title + ' {{controllerTitle}}' });
    form.addField({
        id: 'custpage_{{prefix}}_{{objectName}}_message',
        type: serverWidget.FieldType.INLINEHTML,
        label: 'Message',
    }).defaultValue = '<p>{{controllerTitle}} is not implemented yet.</p>';
    log.audit('{{controllerName}} suitelet', { method: context.request.method });
    context.response.writePage(form);
};
`;

const REACT_APP_RESTLET_OBJECT = String.raw`<restlet scriptid="customscript_{{prefix}}_{{objectName}}">
  <description></description>
  <isinactive>F</isinactive>
  <name>{{appTitle}} {{controllerTitle}}</name>
  <notifyadmins>F</notifyadmins>
  <notifyemails></notifyemails>
  <notifyowner>T</notifyowner>
  <notifyuser>F</notifyuser>
  <scriptfile>[/SuiteScripts/{{appName}}/api/controllers/{{controllerName}}Controller.js]</scriptfile>
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
  <scriptfile>[/SuiteScripts/{{appName}}/api/controllers/{{controllerName}}Controller.js]</scriptfile>
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
import { callRestlet } from './restletClient';

{{#if hasGet}}
export function fetch{{ControllerName}}(request: {{ControllerName}}GetRequest = {}): Promise<{{ControllerName}}GetResponse> {
    return callRestlet<{{ControllerName}}GetResponse>(scripts.{{controllerName}}, 'GET', { query: request });
}

{{/if}}
{{#if hasPost}}
export function create{{ControllerName}}(request: {{ControllerName}}PostRequest): Promise<{{ControllerName}}PostResponse> {
    return callRestlet<{{ControllerName}}PostResponse>(scripts.{{controllerName}}, 'POST', { body: request });
}

{{/if}}
{{#if hasPut}}
export function update{{ControllerName}}(request: {{ControllerName}}PutRequest): Promise<{{ControllerName}}PutResponse> {
    return callRestlet<{{ControllerName}}PutResponse>(scripts.{{controllerName}}, 'PUT', { body: request });
}

{{/if}}
{{#if hasDelete}}
export function delete{{ControllerName}}(request: {{ControllerName}}DeleteRequest): Promise<{{ControllerName}}DeleteResponse> {
    return callRestlet<{{ControllerName}}DeleteResponse>(scripts.{{controllerName}}, 'DELETE', { body: request });
}

{{/if}}
`;

const REACT_APP_SHARED_TYPES = String.raw`// Request and response shapes for the {{controllerName}} restlet. Shared by api/ and client/.

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

const REACT_APP_SCRIPTS_ENTRY = String.raw`    {{controllerName}}: { scriptId: 'customscript_{{prefix}}_{{objectName}}', deployId: 'customdeploy_{{prefix}}_{{objectName}}' },
`;

export const CONTROLLER_TEMPLATES: Record<string, ControllerTemplateSet> = {
    'react-app': {
        restletController: REACT_APP_RESTLET_CONTROLLER,
        suiteletController: REACT_APP_SUITELET_CONTROLLER,
        restletObject: REACT_APP_RESTLET_OBJECT,
        suiteletObject: REACT_APP_SUITELET_OBJECT,
        clientApi: REACT_APP_CLIENT_API,
        sharedTypes: REACT_APP_SHARED_TYPES,
        scriptsEntry: REACT_APP_SCRIPTS_ENTRY,
    },
};
