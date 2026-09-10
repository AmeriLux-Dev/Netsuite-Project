# {{appTitle}}

| | |
|---|---|
| Owner | {{author}} |
| Purpose | {{description}} |
| Scaffolded with | create-netsuite-project {{cliVersion}} (`react-app` template) |

## Why this shape

- **A Suitelet hosts a React single-page app.** NetSuite serves the page and the session; the bundle is one file in the File Cabinet, found by folder and file name, never by internal id.
- **One Restlet per controller, no router.** Each file under `api/src/controllers/` with an `@NScriptType` header becomes its own script and deployment. Permissions, logging and log filtering stay per endpoint.
- **Every NetSuite magic string lives in `common/netsuite.ts`.** Record types, field ids and script ids are grouped by the party that owns them. The client calls restlets through the `scripts` registry, so ids are typed and change in one place.
- **Typed data access** through `@amerilux/netsuite-repository` (decorated models, generated context) and instrumented `N/*` calls through `@amerilux/netsuite-wrapper`.
- **Rationale placeholder:** record here why this application exists and what it replaced.

## Prerequisites

- Node 20 or newer
- Java 17 or newer (the SuiteCloud CLI needs it)
- A NetSuite role that can deploy SDF projects; run `npx suitecloud account:setup` once per account

## Setup

```sh
npm install
npx suitecloud account:setup   # pick or create an authentication id; writes the gitignored project.json
cp client/.env.example client/.env
npm run dev
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 plus the local restlet proxy on port 4000 |
| `npm run build` | Builds the client (Vite) and then the API (webpack) into `netsuite/FileCabinet/SuiteScripts/{{appName}}/` |
| `npm run deploy` | Build, then `suitecloud project:adddependencies` and `project:deploy` |
| `npm run deploy:files` | Build, then upload only the File Cabinet files (fast path after a UI change) |
| `npm run generate` | Regenerate the repository context and types from `api/src/models/` |
| `npm test` | Vitest in every workspace |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint over the whole repository |
| `npm run add:controller -- <name>` | Add a restlet controller with its SDF object, shared types and client API module |

## Layout

```
common/                 Shared by api and client; compiles without NetSuite types
  netsuite.ts           Record types, field ids, script ids, File Cabinet names
  types/                Request and response shapes
api/                    SuiteScript, bundled by webpack into one AMD file per script
  src/controllers/      One Restlet per file
  src/host/             The Suitelet that serves the SPA and its client script
  src/domain/           Pure functions over the repository context
  src/models/           Decorated record models (generated/ is produced, gitignored)
  src/lib/              defineRestlet, ApiError, File Cabinet helpers
  test/stubs/N/         vi.fn shells for N/* modules
  __tests__/            Vitest specs
client/                 React 19, TanStack Router (file-based, hash history), TanStack Query, Tailwind 4
  src/routes/           One file per route; __root.tsx is the layout (routeTree.gen.ts is generated)
  src/api/              callRestlet and one module per controller
  src/features/         Pages and their hooks
  server.ts             Local dev proxy that signs OAuth 2.0 requests to the sandbox
netsuite/               The SDF project: manifest, deploy.xml, Objects/, FileCabinet/ (build output)
scripts/                deploy.mjs, buildInfo.cjs
```

## Build output

```
netsuite/FileCabinet/SuiteScripts/{{appName}}/
  client/app.js                      the SPA (Vite, IIFE, CSS injected by JS)
  api/host/homeController.js         the Suitelet
  api/host/host.js                   client script attached to the Suitelet form
  api/controllers/customersController.js
```

Building the client empties only `client/`; building the API empties only `api/`.

## Deploy

`npm run deploy` needs a `project.json` with the authentication id to use. `npx suitecloud account:setup` writes it. The Suitelet appears under Customization › Scripting › Scripts as **{{appTitle}} Home**.

The client bundle URL carries `?v=<version>-<buildId>`, so a new deploy is picked up without a manual version bump.

## Adding a controller

```sh
npm run add:controller -- orders --methods get,post
```

writes `api/src/controllers/ordersController.ts`, `netsuite/Objects/customscript_{{prefix}}_orders.xml`, `common/types/orders.ts`, `client/src/api/ordersApi.ts`, and adds `scripts.orders` to `common/netsuite.ts`. Implement the handler, then `npm run deploy`.

Add `--suitelet` for a Suitelet instead of a Restlet.

## Adding a page

Routes are files under `client/src/routes/`: `orders.tsx` serves `#/orders`, `orders.$orderId.tsx` serves `#/orders/:orderId`, and `__root.tsx` is the layout around all of them. Export a `Route` built with `createFileRoute` and point its `component` at a page under `src/features/`. The Vite plugin regenerates `src/routeTree.gen.ts` on `npm run dev` and `npm run build`; commit that file but never edit it.

## Adding a model

1. Add a decorated class under `api/src/models/` (see `Customer.ts`).
2. `npm run generate` writes `api/src/models/generated/<Model>.gen.ts` and refreshes `context.gen.ts`.
3. Use it through `createAppContext()` in a domain function; keep controllers thin.

{{#if performanceTracker}}
## PerformanceTracker

`api/netsuite-wrapper.config.js` enables the `performance-tracker` telemetry integration, so every wrapped `N/record`, `N/query`, `N/search`, `N/https` and `N/task` call writes an execution span to the PerformanceTracker custom record. The PerformanceTracker bundle must be installed in the target account. Set `telemetryBootstrap: false` and `instrumentation: false` to turn it off.

{{/if}}
## Local dev proxy

`client/server.ts` forwards `/api/restlet` to the sandbox restlet domain with an OAuth 2.0 client-credentials token. It reads `client/.env` (gitignored); `client/.env.example` lists the values. The private key stays outside the repository. Nothing account-specific is exposed to Vite, so nothing account-specific ends up in the uploaded bundle.

## Testing

- `api/__tests__/` and `client/__tests__/` hold the Vitest specs; tests are never colocated with source.
- `N/*` modules and the wrapper's module entry points resolve to `api/test/stubs/N/`.
- Domain functions take the repository context as an argument, so a test passes a fake.
- UI markup is not unit-tested; hooks and API modules are.

## Conventions

- Function names get more specific as their scope narrows; variable names get more specific as their visibility widens. Never abbreviate.
- `common/` never imports `N/*`.
- Script ids: `customscript_{{prefix}}_<name>` and `customdeploy_{{prefix}}_<name>`, at most 40 characters.
- Controllers export only the HTTP methods they implement.
- Secrets never enter the repository: no account ids, auth ids, `project.json`, `.env` or key files.
