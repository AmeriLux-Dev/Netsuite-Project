# {{appTitle}}

Suitelet-hosted React application for NetSuite, scaffolded by create-netsuite-project (`react-app` template). The README has the longer explanation.

## Commands

| Command | Use it for |
|---|---|
| `npm run generate` | Regenerate `api/src/models/generated/` from the decorated models. Run after touching `api/src/models/`. |
| `npm run typecheck` | `tsc --noEmit` in every workspace (runs generate first). |
| `npm run lint` | ESLint over the repository. |
| `npm test` | Vitest in `api/` and `client/`. |
| `npm run build` | Client (Vite) then API (webpack) into `netsuite/FileCabinet/SuiteScripts/{{appName}}/`. |
| `npm run dev` | Vite on port 3000 plus the local restlet proxy on port 4000. Needs `client/.env`. |
| `npm run add:controller -- <name> [--methods get,post] [--suitelet]` | New controller folder with one endpoint per method, SDF object, shared types, client API, `scripts.<name>` entry. Use it instead of hand-writing script ids. |
| `npm run deploy` / `npm run deploy:files` | Deploy to the account in `project.json`. Only when the person asked for it. |

Before a commit: `npm run typecheck`, `npm run lint`, `npm test`.

## Where things live

- `common/` is shared by api and client. `common/netsuite.ts` is the single home for NetSuite identifiers: record types and field ids grouped by owning party (`netsuite`, `sps`, `avalara`, …), and `scripts` with every script and deployment id. Keep the `// @netsuite-project:scripts` marker inside `scripts`.
- The `customers` controller, page and API module are the scaffold's example, marked `@netsuite-project:example`; `npm run deploy` refuses while they exist. Replace or delete them rather than building on them.
- `api/src/controllers/<name>/`: one folder per controller. `endpoints/` holds one transport-agnostic function per HTTP method (`Endpoint<Request, Response>`, composed in `endpoints/index.ts`); `<name>Controller.ts` is the only transport-specific file and serves them through `defineRestlet` or `defineSuitelet` from `api/src/lib/`, which supply the envelope, error mapping and timing. A file becomes a deployed script only when its leading JSDoc carries `@NScriptType`; everything else under `api/src/` is bundled into the scripts that import it. Endpoints stay thin: call a domain function, return its result. Switching transport touches the controller file, its SDF object and `kind` on the `scripts` entry, nothing else.
- `api/src/domain/`: pure functions that take the repository context (`createAppContext()`) as an argument, so a test passes a fake.
- `api/src/models/`: `@RecordType` classes; `generated/` is produced by `npm run generate`.
- `api/src/host/`: the Suitelet that serves the SPA and its client script. The bundle is found by folder and file name, never by internal id.
- `client/src/routes/`: file-based routing (TanStack Router, hash history); `routeTree.gen.ts` is produced by the Vite plugin. Pages and hooks live under `client/src/features/`, one API module per controller under `client/src/api/`, every call through `callEndpoint`, which picks the URL from the script's `kind`.
- `netsuite/`: the SDF project. `Objects/*.xml` are script records; `FileCabinet/` is build output.
- Tests live in `api/__tests__/` and `client/__tests__/`; `N/*` and the wrapper's module entry points resolve to `api/test/stubs/N/`. Test hooks, API modules, domain functions and the transport wrappers, not UI markup.

## Conventions

- **Naming.** A function name gets more specific as its responsibility narrows (`update` → `updateTransaction` → `updateTransactionShippingAddress`). A variable name gets more specific as its visibility widens (`transaction` inside a function, `vendorBillTransaction` at file scope, `vendorBillTransactionTemplate` globally). Never abbreviate.
- **SuiteScript constraints.** Server handlers are synchronous. Emitted code targets ES2019, so optional chaining and nullish coalescing are downlevelled by TypeScript. `N/*` calls are rewritten to the wrapper at build time; do not add a custom externals function to `api/webpack.config.js`.
- **Script ids** are `customscript_{{prefix}}_<name>` / `customdeploy_{{prefix}}_<name>`, at most 40 characters.
{{#unless probity}}

## Rules

- Tests go under a `__tests__/` folder, never next to source, and are never focused or skipped.
- `common/` never imports `N/*`; it is bundled into the client too.
- NetSuite identifiers are imported from `common/netsuite.ts`, not written as string literals in `api/src/` or `client/src/`.
- Never edit generated output: `api/src/models/generated/`, `client/src/routeTree.gen.ts`, `netsuite/FileCabinet/`.
- Never write secrets or account selection: no `project.json`, `client/.env`, keys or certificates, and nothing account-specific under the Vite client prefix (Vite inlines it into the uploaded bundle). Update `.env.example` instead.
- Run `npm test` and `npm run typecheck` before a commit, and `npm test` before any deploy. Deploying is a human action: do not run `npm run deploy` or `suitecloud` uploads unless asked.
- No recursive force deletes, no `--no-verify`, no force push without `--force-with-lease`.
{{/unless}}
{{#if probity}}

## Guardrails

Probity (`probity.config.ts`, hooked into Claude Code through `.claude/settings.json`) enforces the rules of this repository mechanically and blocks: destructive commands, commits without tests and typecheck, deploys without tests, `N/*` imports in `common/`, NetSuite ids as string literals outside `common/netsuite.ts`, writes to generated output or secret files, colocated or focused tests. It also requires a failing test first for domain functions, the restlet primitive, client API modules and hooks. When a block fires, fix the cause rather than working around it.
{{/if}}
