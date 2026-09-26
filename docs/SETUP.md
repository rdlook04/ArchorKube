# Setting up ArchorKube

This is the procedure to install ArchorKube on a Dynatrace tenant and confirm it works. It's written so that a person **or an AI agent** can follow it end to end. If you're an agent, read [Rules for agents](#rules-for-agents) first.

The short version:

1. Install.
2. Create the local config files from their `.example` (three config files plus `.env`).
3. Discover where your tenant keeps owners, instance types and useful labels.
4. Fill `site.ts` and choose the ownership provider.
5. Run the app and open **Setup** until nothing says *Not working*.
6. Deploy (a person confirms this step).

---

## Rules for agents

- **Never ask for, paste or store tokens.** `dt-app` logs in through the browser the first time it runs; the person does that. Don't read `archor-kube/.dt-app/`.
- **Four files are local and never committed:** `archor-kube/.env`, `ui/app/ownership/active.ts`, `ui/app/ownership/port.ts` (optional) and `ui/app/config/site.ts`. All installation-specific values go there, nowhere else. If you think you need a fifth local file, stop and ask: it means something is being coupled to one organization.
- **Don't invent owners, tiers or prices.** When the data isn't in the tenant, leave the field empty (the app shows "unknown" instead of wrong numbers) and tell the person what's missing.
- **Deploying is the person's call.** It installs an app in their tenant and asks them to consent scopes. Prepare everything, then ask.
- **Don't change a mapping just because another label covers more workloads.** Compare the values first: a tier label with `1, 2, 3` and a "criticality" label with business names are different data, even if the second one is more common. A tier must look like a tier (`1, 2, 3`, `t1`, `tier-2`). Offer the other key as an optional filter instead.
- **A key with a single value is useless as a filter** (an `environment` that is always `prod`). Don't add it.
- **Ignore the `npx dt-app update` banner** that builds print. Updating changes dependencies; that's the maintainers' decision, not part of a setup.

---

## 1. Install

Requirements: Node 24 (pinned in `.node-version`; with fnm or nvm, run `fnm use` or `nvm use` inside `archor-kube/`), a Dynatrace tenant with Kubernetes monitored (Dynatrace Operator), and permission to install apps in it. The login to the tenant comes later: `dt-app` opens the browser the first time `npm start` runs.

```bash
git clone https://github.com/rdlook04/ArchorKube.git
cd ArchorKube/archor-kube
npm install
```

## 2. Copy the local config files

```bash
cp .env.example .env
cp ui/app/ownership/active.ts.example ui/app/ownership/active.ts
cp ui/app/config/site.ts.example ui/app/config/site.ts
```

Edit `.env` and set the tenant:

```
DT_APP_ENVIRONMENT_URL=https://<your-tenant>.apps.dynatrace.com/
```

`port.ts` is only for a custom catalog connector (Backstage, a CMDB). Skip it unless you have one; see [OWNERSHIP.md](OWNERSHIP.md).

## 3. Discover what your tenant has

Every check the app runs lives in one file: [`archor-kube/ui/app/setup/checks.ts`](../archor-kube/ui/app/setup/checks.ts). Each entry has the DQL, what it affects and how to fix it. There are three ways to run them:

| Option | When |
|---|---|
| **Start the app and open Setup** (`npm start`, then the *Setup* button) | Easiest. Runs all checks with the right permissions and explains each result. |
| Dynatrace MCP server | If the agent has it connected: run the `query` of each check from `checks.ts`. |
| A Dynatrace notebook | If you only have the tenant UI. Copy the DQL from `checks.ts` or from *How to fix* in Setup. |

The three discovery queries that decide the configuration:

**Where owners live (label keys).** Counts how many workloads carry each label key. The labels provider reads this same source. Run it again with `kubernetesAnnotations` in place of `cloudApplicationLabels` to count annotations.

```
fetch dt.entity.cloud_application
| fields id, s = toString(cloudApplicationLabels)
| fieldsAdd pair = splitString(s, "\", \"")
| expand pair
| parse pair, "LD:k '\":'"
| fieldsAdd k = replaceString(k, "{\"", "")
| summarize workloads = countDistinct(id), by:{k}
| sort workloads desc
```

Then look at the values of each candidate key before deciding what it means (replace `team`):

```
fetch dt.entity.cloud_application
| fields v = coalesce(kubernetesAnnotations[`team`], cloudApplicationLabels[`team`])
| filter isNotNull(v)
| summarize workloads = count(), by:{v}
| sort workloads desc
| limit 20
```

Setup's *Ownership label keys and optional filters* check does both in one step.

**Instance types (for prices).**

```
smartscapeNodes K8S_NODE
| fields t = tags[`beta.kubernetes.io/instance-type`]
| summarize n = count(), by:{t}
```

**Cost allocation (optional).** If Dynatrace cost allocation is configured, Kubernetes data carries cost centers:

```
timeseries r = sum(dt.kubernetes.container.requests_cpu), by:{dt.cost.costcenter}, from: now()-2h
| filter isNotNull(dt.cost.costcenter)
```

## 4. Configure

### Choose the ownership provider (`ownership/active.ts`)

Owners are resolved **field by field** through a chain: the first provider that answers `tier`, `squad`, `tribu` or `appCode` wins for that field.

| What discovery showed | Put in the chain |
|---|---|
| A label key with the team on most workloads (roughly half or more) | `labelsProvider`, with that key in `OWNERSHIP_KEYS` |
| Each team has its own namespaces | `namespaceProvider` (the namespace becomes the team), usually last |
| A catalog outside Kubernetes (Backstage, CMDB, a lookup table in Grail) | Your own provider in `port.ts`, first in the chain |
| A few workloads resolve wrong | `manualProvider()` rules, first in the chain |

The default chain (`manual → labels → namespace`) is a good start for most clusters, **once the excluded namespaces are settled**: with `namespaceProvider` in the chain, every namespace that isn't excluded counts as a team. A `monitoring` or `ingress-nginx` namespace left in shows up as a squad and makes ownership coverage look better than it is. Setup's *Namespaces that aren't teams are excluded* check lists them.

### Fill `config/site.ts`

| Setting | What to put | From |
|---|---|---|
| `OWNERSHIP_KEYS` | The label keys for tier, squad, tribe/domain and app code | Discovery query 1 |
| `EXTRA_FILTERS` | Other label keys people want to filter by (business criticality, cost center, product, environment) | Discovery query 1: keys that aren't owners |
| `EXCLUDED_NAMESPACES_EXACT` / `_CONTAINING` | System and platform namespaces that aren't workloads of any team. Prefer exact names: a substring like `system` also drops a team namespace called `payment-system` | Ask the person; Setup flags platform namespaces left in and team namespaces dropped by a substring |
| `INSTANCE_HOURLY_USD` | Hourly price for each instance type found | Discovery query 2 + the person's pricing (list price or contract) |
| `PRICING_SOURCE` | Where the prices came from, in words | The person |

`EXTRA_FILTERS` example:

```ts
export const EXTRA_FILTERS: ExtraFilter[] = [
  { id: "criticality", label: "Business criticality", key: "business-criticality" },
  { id: "costcenter", label: "Cost center", key: "cost-center" },
];
```

A filter whose key doesn't exist in the tenant is hidden, so a wrong key fails quietly: Setup tells you.

## 5. Verify

```bash
npm run verify   # typecheck + lint + build
npm start        # opens the app against the tenant in .env
```

Open **Setup** in the app header and work through the results:

- **Not working**: a module depends on this. Fix it before trusting that module.
- **Needs attention**: works, but partially (for example, only some workloads have an owner). Explain it to the person.
- **Optional**: nothing breaks; it enables something extra if configured.

Re-run Setup after each change to `site.ts` or `active.ts`. You're done when nothing says *Not working* and every *Needs attention* has an explanation the person accepts.

### If you can't open the app

An agent without a browser can't log in, so it can't see Setup. In that case:

1. Make sure `npm run verify` passes.
2. Get the discovery results from the person (or through the Dynatrace MCP server) and configure from them.
3. Hand over with a list of what's left to confirm: the questions you asked, the fields you left empty, and a request to open Setup after the first `npm start` and send back anything that isn't OK.

That handover is the done criterion; don't report the setup as validated until someone has seen Setup.

## 6. Deploy (the person confirms)

`app.config.json` needs a new `version` for every deploy (the tenant rejects reinstalling the same version with different content). Then:

```bash
npm run deploy
```

The tenant asks to consent these scopes. What each one is for:

| Scope | Used for |
|---|---|
| `storage:entities:read`, `storage:smartscape:read` | Kubernetes objects: workloads, pods, HPAs, nodes, namespaces |
| `storage:metrics:read` | Usage, requests, limits, restarts, node capacity |
| `storage:logs:read` | Errors module |
| `storage:events:read` | Events used by Preventive and Control plane |
| `storage:buckets:read`, `storage:files:read` | Lookup tables (ownership catalogs) |
| `state:user-app-states:read`, `:write` | Each user's AI data mode in Settings |
| `storage:events:write` | One business event per finding sent to an AI outside Dynatrace (never the content) |

After deploying, open Setup again in the tenant: *Per-user settings can be saved* confirms the state scopes were consented.

---

## Optional: send findings to a local Ollama

Dynatrace apps can't connect to your machine, so ArchorKube opens a small local page that talks to Ollama. See [`tools/ollama-bridge`](../tools/ollama-bridge/README.md). Nothing to configure in the tenant.
