# create-netsuite-project

Scaffold a Suitelet-hosted React application for NetSuite in one command.

```sh
npm create netsuite-project@latest MyApp
# or
npx create-netsuite-project MyApp
```

The generated project is a small monorepo: a Vite + React 19 + Tailwind 4 client served by a Suitelet, a webpack-built SuiteScript API where **every controller is its own Restlet**, a shared `common/` workspace holding every NetSuite identifier in one file, typed data access through [`@amerilux/netsuite-repository`](https://www.npmjs.com/package/@amerilux/netsuite-repository), instrumented `N/*` calls through [`@amerilux/netsuite-wrapper`](https://www.npmjs.com/package/@amerilux/netsuite-wrapper), Vitest everywhere, ESLint, and deployment scripts around the SuiteCloud CLI.

## What you get

```
MyApp/
  common/netsuite.ts        record types, field ids, script ids, File Cabinet names
  api/src/controllers/      one Restlet per file (customersController.ts to start)
  api/src/host/             the Suitelet that serves the SPA
  api/src/models/           decorated models; `npm run generate` writes the typed context
  client/src/               React app: TanStack Router (file-based routes under src/routes, hash history), TanStack Query, Tailwind
  client/server.ts          local dev proxy that signs OAuth 2.0 calls to your sandbox
  netsuite/                 SDF project: manifest, deploy.xml, Objects/, FileCabinet/ (build output)
  scripts/deploy.mjs        build → suitecloud project:deploy (or file:upload only)
```

Build output lands in `netsuite/FileCabinet/SuiteScripts/MyApp/`: `client/app.js` plus one AMD file per script under `api/`. Each API file starts with the `@NApiVersion` / `@NScriptType` banner NetSuite expects.

## Prompts and flags

Every prompt has a flag, so the command works unattended:

| Prompt | Flag | Default |
|---|---|---|
| Project name | `[directory]` or `--name` | required |
| Script id prefix | `--prefix` | derived from the name, max 8 characters |
| Author or team | `--author` | `git config user.name` |
| Description | `--description` | a one-liner |
| PerformanceTracker telemetry | `--performance-tracker` / `--no-performance-tracker` | off |
| Install dependencies | `--install` / `--no-install` | yes |
| Initialise git | `--git` / `--no-git` | yes |
| Deploy now | `--deploy` / `--no-deploy` (with `--auth-id`) | no |

`--yes` accepts every default. `--ref <gitref>`, `--repo <owner/repo>` and `--local-template <path>` control where the template comes from; by default the CLI downloads `templates/react-app` from the release tag matching its own version.

Script ids are `customscript_<prefix>_<name>` and NetSuite caps them at 40 characters, so the prefix is 2 to 10 lowercase characters and controller names are checked against the remaining budget.

## Adding a controller

Inside a generated project:

```sh
npm run add:controller -- orders --methods get,post
```

writes the controller, its SDF script object, shared request/response types, a client API module, and registers `scripts.orders` in `common/netsuite.ts`. Add `--suitelet` for a Suitelet instead of a Restlet.

## Deploying

```sh
npx suitecloud account:setup   # once per account; writes the gitignored project.json
npm run deploy                 # build, project:adddependencies, project:deploy
npm run deploy:files           # build, then upload only File Cabinet files
```

The client bundle URL carries the version and a build id, so a new deploy is picked up without a manual cache bust.

## Requirements

- Node 20 or newer
- Java 17 or newer, for the SuiteCloud CLI
- git (optional; used for the first commit and the default author)

## Repository layout

```
cli/                  the published package (name: create-netsuite-project); only dist/ ships
templates/react-app/  the template the CLI renders; tokens look like {{appName}}
scripts/              private-reference scan and the local end-to-end check
.github/workflows/    CI (CLI checks, scaffold on Linux and Windows, secret scan) and release
```

### Developing

```sh
npm install
npm test                    # CLI unit tests
npm run e2e:local           # build the CLI, scaffold from templates/react-app into the OS temp dir, install, typecheck, lint, test, build
node cli/dist/index.js ./Sandbox --local-template templates/react-app --prefix sbx --yes --no-install --no-git
```

### Releasing

1. Bump `cli/package.json` version.
2. Tag `v<version>` and push the tag. The release workflow verifies the tag matches, runs the checks and publishes with provenance.

The tag is also the template ref the published CLI downloads, so templates and CLI always ship together.

## Security

This repository is public. Nothing account-specific belongs here: no account ids, authentication ids, `project.json`, `.env` files, keys or certificates. CI runs gitleaks and `scripts/check-no-private-refs.mjs` on every push.

## License

[MIT](./LICENSE)
