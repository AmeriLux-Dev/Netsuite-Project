# @amerilux/create-netsuite-project

Scaffold a Suitelet-hosted React application for NetSuite in one command.

```sh
npm create @amerilux/netsuite-project@latest MyApp
# or
npx @amerilux/create-netsuite-project MyApp
```

The generated project is a small monorepo: a Vite + React 19 + Tailwind 4 client served by a Suitelet, a webpack-built SuiteScript API where **every controller is its own script** (transport-agnostic endpoints served by a Restlet or a Suitelet, switchable in one file), a shared `common/` workspace holding the decorated record models and every script id, typed data access through [`@amerilux/netsuite-repository`](https://www.npmjs.com/package/@amerilux/netsuite-repository), instrumented `N/*` calls through [`@amerilux/netsuite-wrapper`](https://www.npmjs.com/package/@amerilux/netsuite-wrapper), Vitest everywhere, ESLint, and deployment scripts around the SuiteCloud CLI.

## What you get

```
MyApp/
  common/model/             decorated record models; each declares its record type and field ids
  common/dto/               request and response shapes of each controller, picked from the generated entity types
  common/types/             api.ts, one endpoint contract per controller, models.gen.ts (generated entity types)
  common/netsuite.ts        app names, script ids, and any id no model owns
  api/src/controllers/      one folder per controller: endpoints/ + a Restlet or Suitelet file (customers/ to start)
  api/src/host/             the Suitelet that serves the SPA
  api/src/services/         decisions: interpret the request, call repositories, shape the reply
  api/src/repositories/     query and write functions over dbContext; generated/ comes from `npm run generate`
  api/src/specifications/   query predicates, one module per record type
  client/src/               React app: TanStack Router (file-based routes under src/routes, hash history), TanStack Query, Tailwind
  client/server.ts          local dev proxy that signs OAuth 2.0 calls to your sandbox
  netsuite/                 SDF project: manifest, deploy.xml, Objects/, FileCabinet/ (build output)
  scripts/deploy.mjs        build → suitecloud project:deploy (or file:upload only)
  scripts/checkStructure.mjs run by npm run lint: every script's pieces (ids, SDF object, controller, contract, DTOs, client) agree
  .claude/skills/           add-controller: the recipe Claude Code follows to add a controller
  README.md                 the application record: purpose, owners, dependencies, deployment, support, decisions
  HOW-TO-USE.md             how to build, run, test, deploy and extend the project
  CLAUDE.md                 project brief for Claude Code
  probity.config.ts         agent guardrails (Probity), wired up in .claude/settings.json; only with --probity
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
| Probity guardrails for AI agents | `--probity` / `--no-probity` | off |
| Install dependencies | `--install` / `--no-install` | yes |
| Initialise git | `--git` / `--no-git` | yes |

`--yes` accepts every default. `--ref <gitref>`, `--repo <owner/repo>` and `--local-template <path>` control where the template comes from; by default the CLI downloads `react-app` from [netsuite-project-templates](https://github.com/AmeriLux-Dev/netsuite-project-templates) at the ref pinned in its own `package.json`, so a given CLI version always scaffolds the same template.

Script ids are `customscript_<prefix>_<name>` and NetSuite caps them at 40 characters, so the prefix is 2 to 10 lowercase characters; the project's structure check keeps every later script id within the budget.

## Adding a controller

A controller is one deployed script with named endpoints (`orders` with `list`, `byId`, `create`): a scripts entry, DTOs, a contract, one file per endpoint, the controller file, its SDF object and a client API module. The generated project documents the eight pieces in HOW-TO-USE.md, ships an `add-controller` skill for Claude Code that writes them, and its `npm run lint` runs a structure check that fails until they all exist and agree (ids, transport, endpoint names). The `customers` controller is the reference.

## Deploying

The scaffold never deploys. The customers controller and page it generates are marked as example code, and the project's `npm run deploy` refuses to run while any marked file is present, so the example never clutters a File Cabinet. Replace it with your own controller, or delete it, then:

```sh
npx suitecloud account:setup   # once per account; writes the gitignored project.json
npm run deploy                 # build, project:adddependencies, project:deploy
npm run deploy:files           # build, then upload only File Cabinet files
```

`--allow-example` overrides the guard for a throwaway sandbox.

The client bundle URL carries the version and a build id, so a new deploy is picked up without a manual cache bust.

## Requirements

- Node 22 or newer
- Java 17 or newer, for the SuiteCloud CLI
- git (optional; used for the first commit and the default author)

## Repository layout

This repository holds only the CLI. The templates it renders live in [netsuite-project-templates](https://github.com/AmeriLux-Dev/netsuite-project-templates), one folder per project type.

```
src/                  the CLI: commands, prompts, template download and render, the controller generator
__tests__/            unit tests (vitest)
scripts/              private-reference scan and the end-to-end wrapper
.github/workflows/    CI (checks, scaffold with the pinned template on Linux and Windows, secret scan) and release
```

`templateSource` in `package.json` pins the template repository and git ref a release downloads by default; `--repo` and `--ref` override it at run time.

### Developing

```sh
npm install
npm test                    # unit tests
npm run e2e                 # build, then run the template repository's end-to-end check against this build
node dist/index.js ./Sandbox --local-template ../netsuite-project-templates/react-app --prefix sbx --yes --no-install --no-git
```

`npm run e2e` expects a checkout of the template repository at `../netsuite-project-templates`; set `NETSUITE_PROJECT_TEMPLATES_DIR` to use another path. CI runs the same check against the pinned ref.

### Releasing

1. If the template changed, tag and push a release in the template repository first, then set `templateSource.ref` here to that tag.
2. Bump `version` in `package.json`.
3. Tag `v<version>` and push the tag. The release workflow verifies the tag matches, checks that the pinned template ref exists, runs the checks and publishes with provenance.

## Security

This repository is public. Nothing account-specific belongs here: no account ids, authentication ids, `project.json`, `.env` files, keys or certificates. CI runs gitleaks and `scripts/check-no-private-refs.mjs` on every push.

## License

[MIT](./LICENSE)
