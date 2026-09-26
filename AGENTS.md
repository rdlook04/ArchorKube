# ArchorKube, for AI agents

ArchorKube is a Dynatrace app (AppEngine, React + Strato) that reviews Kubernetes best practices from Grail data and gives every finding an owner and a priority. The app lives in `archor-kube/`.

## If you were asked to install or set it up

Follow [`docs/SETUP.md`](docs/SETUP.md) from start to end. In short: copy the local config files, run the discovery queries from `archor-kube/ui/app/setup/checks.ts`, fill `site.ts` and `active.ts`, then run the app and open **Setup** until nothing says *Not working*. Claude Code users also have the `archorkube-setup` skill in `.claude/skills/`.

## Rules that always apply

- Never ask for, paste or store Dynatrace tokens. `dt-app` logs in through the browser. Don't read `archor-kube/.dt-app/`.
- Installation-specific values go only in the four local files (three config files plus `.env`), never committed: `archor-kube/.env`, `archor-kube/ui/app/ownership/active.ts`, `archor-kube/ui/app/ownership/port.ts` (optional) and `archor-kube/ui/app/config/site.ts`. Each has a versioned `.example`.
- Don't invent owners, tiers or prices. Missing data stays empty and shows as "unknown".
- Deploying (`npm run deploy`) installs the app in someone's tenant: prepare it, then ask the person.

## If you were asked to change the code

- Read `archor-kube/AGENTS.md` for the Dynatrace App Toolkit, Strato and DQL conventions.
- Harness: `npm run verify` in `archor-kube/` (typecheck + lint + build) must pass.
- The repo has no Prettier config and existing code wraps at about 100 columns. Don't reformat files you didn't change.
- Where things live:
  - `ui/app/queries/`: one DQL file per module; filters join through `tierJoin.ts`.
  - `ui/app/ownership/`: how a workload becomes `{ tier, squad, tribu, appCode }`. The only place that knows about an organization's catalog.
  - `ui/app/practices/catalog.ts`: the best-practice standard (the Guide tab and "Why is this flagged?").
  - `ui/app/setup/checks.ts`: what the app needs from a tenant. If a module starts depending on new data, add its check here.
  - `ui/app/ai/redact.ts`: the only way data leaves Dynatrace toward an external AI. Anything sent outside goes through it and through the preview.
