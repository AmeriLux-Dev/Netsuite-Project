# {{appTitle}}

| | |
|---|---|
| Owner | {{author}} |
| Purpose | {{description}} |
| Scaffolded with | create-netsuite-project {{cliVersion}} (`react-app` template) |

## Why this shape

- **A Suitelet hosts a React single-page app.** NetSuite serves the page and the session; the bundle is one file in the File Cabinet, found by folder and file name, never by internal id.
- **One script per controller, no router.** Each controller is a folder under `api/src/controllers/`: transport-agnostic handlers under `endpoints/` and one file with an `@NScriptType` header that serves them as a Restlet or a Suitelet. Switching transport is a change to that file, its SDF object and the `kind` in `scripts`; the endpoints and the client do not change. Permissions, logging and log filtering stay per script.
- **Every NetSuite magic string lives in `common/netsuite.ts`.** Record types, field ids and script ids are grouped by the party that owns them. The client calls restlets through the `scripts` registry, so ids are typed and change in one place.
- **Typed data access** through `@amerilux/netsuite-repository` (decorated models, generated context) and instrumented `N/*` calls through `@amerilux/netsuite-wrapper`.
- **Rationale placeholder:** record here why this application exists and what it replaced.

## Prerequisites

- Node 22 or newer
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
| `npm run deploy` | Build, then `suitecloud project:adddependencies` and `project:deploy`; refuses while example code is present |
| `npm run deploy:files` | Build, then upload only the File Cabinet files (fast path after a UI change); same guard |
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
  src/controllers/      One folder per controller: <name>Controller.ts (Restlet or Suitelet) + endpoints/
  src/host/             The Suitelet that serves the SPA and its client script
  src/domain/           Pure functions over the repository context
  src/models/           Decorated record models (generated/ is produced, gitignored)
  src/lib/              endpoint, defineRestlet, defineSuitelet, ApiError, File Cabinet helpers
  test/stubs/N/         vi.fn shells for N/* modules
  __tests__/            Vitest specs
client/                 React 19, TanStack Router (file-based, hash history), TanStack Query, Tailwind 4
  src/routes/           One file per route; __root.tsx is the layout (routeTree.gen.ts is generated)
  src/api/              callRestlet and one module per controller
  src/features/         Pages and their hooks
  server.ts             Local dev proxy that signs OAuth 2.0 requests to the sandbox
netsuite/               The SDF project: manifest, deploy.xml, Objects/, FileCabinet/ (build output)
scripts/                deploy.mjs, buildInfo.cjs
CLAUDE.md               Project brief for Claude Code
{{#if probity}}
probity.config.ts       Agent guardrails (hooked up in .claude/settings.json)
{{/if}}
```

## Build output

```
netsuite/FileCabinet/SuiteScripts/{{appName}}/
  client/app.js                      the SPA (Vite, IIFE, CSS injected by JS)
  api/host/homeController.js         the Suitelet
  api/host/host.js                   client script attached to the Suitelet form
  api/controllers/customers/customersController.js
```

Building the client empties only `client/`; building the API empties only `api/`.

## Deploy

The customers controller, its SDF object and the customers page are scaffold examples, marked with `@netsuite-project:example`. `npm run deploy` and `npm run deploy:files` refuse to run while any marked file is present, so the example never ends up in a File Cabinet. Replace it with `npm run add:controller -- <name>` or delete it (`api/src/controllers/customers/`, `netsuite/Objects/customscript_{{prefix}}_customers.xml`, `client/src/features/customers/`, `client/src/api/customersApi.ts`, `common/types/customers.ts`, and the `customers` entry in `scripts`). `--allow-example` overrides the guard for a throwaway sandbox.

`npm run deploy` needs a `project.json` with the authentication id to use. `npx suitecloud account:setup` writes it. The Suitelet appears under Customization › Scripting › Scripts as **{{appTitle}} Home**.

The client bundle URL carries `?v=<version>-<buildId>`, so a new deploy is picked up without a manual version bump.

## Adding a controller

```sh
npm run add:controller -- orders --methods get,post
```

writes `api/src/controllers/orders/` (`ordersController.ts` plus `endpoints/index.ts`, `endpoints/getOrders.ts`, `endpoints/postOrders.ts`), `netsuite/Objects/customscript_{{prefix}}_orders.xml`, `common/types/orders.ts`, `client/src/api/ordersApi.ts`, and adds `scripts.orders` to `common/netsuite.ts`. Implement the endpoints, then `npm run deploy`.

Add `--suitelet` to serve the same endpoints from a Suitelet instead of a Restlet.

### Switching a controller between Restlet and Suitelet

1. In `<name>Controller.ts`, change `@NScriptType` and swap `defineRestlet` for `defineSuitelet` (or back).
2. Replace the SDF object in `netsuite/Objects/` with the other element type (`<restlet>` or `<suitelet>`).
3. Set `kind` on `scripts.<name>` in `common/netsuite.ts`. The client reads it to build the URL, so `client/src/api/<name>Api.ts` does not change.

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

`client/server.ts` forwards `/api/restlet` to the sandbox restlet domain and `/api/suitelet` to the application domain, both with an OAuth 2.0 client-credentials token. It reads `client/.env` (gitignored); `client/.env.example` lists the values. The private key stays outside the repository. Nothing account-specific is exposed to Vite, so nothing account-specific ends up in the uploaded bundle.

## Testing

- `api/__tests__/` and `client/__tests__/` hold the Vitest specs; tests are never colocated with source.
- `N/*` modules and the wrapper's module entry points resolve to `api/test/stubs/N/`.
- Domain functions take the repository context as an argument, so a test passes a fake.
- UI markup is not unit-tested; hooks and API modules are.

## Working with an AI coding agent

- `CLAUDE.md` is the project brief Claude Code reads on every session: commands, layout and the rules below.
- `.claude/settings.json` pre-approves the read-only npm scripts (generate, typecheck, lint, build, test).
{{#if probity}}
- `probity.config.ts` turns the mechanical rules into guardrails through [Probity](https://github.com/nizos/probity): no destructive commands, tests and typecheck before a commit, no `N/*` in `common/`, no writes to generated output or secrets, tests only under `__tests__/`, no focused tests, and test-first for domain functions, the restlet primitive, client API modules and hooks. `.claude/settings.json` wires it into Claude Code's `PreToolUse` hook; the same config works for Codex and Copilot CLI (see Probity's setup guide).
- Remove the `enforceTdd` block from `probity.config.ts` if test-first enforcement is not wanted; the rest stays useful on its own.
{{/if}}
{{#unless probity}}
- This project was scaffolded without [Probity](https://github.com/nizos/probity) guardrails. To add them later: `npm install -D @nizos/probity`, create `probity.config.ts`, and add its `PreToolUse` hook to `.claude/settings.json` as described in Probity's setup guide. Scaffolding with `--probity` produces a ready-made config.
{{/unless}}

## Conventions

- Function names get more specific as their scope narrows; variable names get more specific as their visibility widens. Never abbreviate.
- `common/` never imports `N/*`.
- Script ids: `customscript_{{prefix}}_<name>` and `customdeploy_{{prefix}}_<name>`, at most 40 characters.
- Endpoints are transport-agnostic functions under `controllers/<name>/endpoints/`; a Restlet controller exports only the HTTP methods it implements.
- Secrets never enter the repository: no account ids, auth ids, `project.json`, `.env` or key files.
