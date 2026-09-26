---
name: archorkube-setup
description: Install and configure ArchorKube on a Dynatrace tenant and validate it with the Setup tab. Use when asked to set up, install, configure or troubleshoot ArchorKube, connect it to a tenant, map owners (labels, namespaces, catalog), add optional filters or fill instance prices.
---

# ArchorKube setup

The full procedure is in `docs/SETUP.md`. Read it, then follow these steps. Stop and ask the person where a step says so.

## Before you start

- Never ask for, paste or store tokens. `dt-app` opens the browser to log in; the person does it. Don't read `archor-kube/.dt-app/`.
- Ignore the `npx dt-app update` banner builds print: updating dependencies is not part of a setup.
- Only four files hold installation values (three config files plus `.env`) and none is committed: `archor-kube/.env`, `archor-kube/ui/app/ownership/active.ts`, `archor-kube/ui/app/ownership/port.ts` (optional), `archor-kube/ui/app/config/site.ts`.

## Steps

1. **Ask for the tenant URL** (`https://<tenant>.apps.dynatrace.com/`) if you don't have it.
2. **Install and copy the local files** from `archor-kube/`:
   ```bash
   npm install
   cp .env.example .env
   cp ui/app/ownership/active.ts.example ui/app/ownership/active.ts
   cp ui/app/config/site.ts.example ui/app/config/site.ts
   ```
   Put the tenant URL in `.env` as `DT_APP_ENVIRONMENT_URL`.
3. **Run the app and let Setup discover the tenant**: `npm start`, tell the person to log in when the browser opens, then open the *Setup* button. If you can't see the app, follow "If you can't open the app" in `docs/SETUP.md`: get the discovery results through the Dynatrace MCP server or from the person (the DQL is in SETUP.md and in `ui/app/setup/checks.ts`).
4. **Configure from what Setup found:**
   - *Ownership label keys and optional filters*: before copying a suggested key into `OWNERSHIP_KEYS`, compare its sample values with what the field means. A tier is a short scale (`1, 2, 3`); a key with business names is a different field even if it covers more workloads. Keys that aren't owners but that people filter by go in `EXTRA_FILTERS`, except keys with a single value.
   - *Workloads with an owner* low: pick the provider chain in `active.ts` (see the table in `docs/SETUP.md`).
   - *Instance prices*: list the missing instance types and **ask the person for prices**; never guess. Record the source in `PRICING_SOURCE`.
   - *Namespaces that aren't teams are excluded*: ask the person which platform namespaces to exclude before trusting ownership coverage. With the namespace provider in the chain, any namespace left in counts as a team. Prefer exact names over substrings.
5. **Verify**: `npm run verify`, reload Setup. Repeat step 4 until nothing says *Not working* and every *Needs attention* is explained to the person. Without the app, hand over the list of things still to confirm instead of reporting it as validated.
6. **Deploy only when the person confirms**: bump `version` in `app.config.json`, run `npm run deploy`, and tell them which scopes they'll be asked to consent (table in `docs/SETUP.md`). After deploying, open Setup in the tenant once more.

## Report back

Summarize: tenant, ownership chain, keys and filters configured, checks still in *Needs attention* and why, prices source, and whether it was deployed.
