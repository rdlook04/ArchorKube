# ArchorKube

*English · [Español](README.md)*

A Dynatrace app that reviews Kubernetes best practices and **puts an owner on every finding**.

> **The name.** *Arch* from architecture, and *archon* — from the Greek *arkhon*, "the one who governs": the magistrates who ran the state — on top of *Kube*rnetes. Not one more dashboard that reports: the one that runs the queue, assigning an owner, a criticality and an order of attention to every finding.

A large cluster doesn't have a detection problem: it has an assignment problem. Tools find hundreds of workloads that are oversized, single-replica or getting OOM-killed, and that list dies on a dashboard because nobody knows which ones are theirs or which one matters first. ArchorKube solves that part: it joins every finding with the owning team and its business criticality, and delivers **a prioritized queue per squad** instead of an inventory of problems.

It runs on AppEngine and queries Grail with DQL. It installs nothing in your clusters.

---

## The modules

| # | Module | What it finds |
|---|---|---|
| M1/M2 | CPU and memory rightsizing | Workloads requesting far more than they use, valued in USD/month |
| M3 | Idle | Workloads with no traffic and no consumption, candidates to scale to zero |
| M4 | Density | Real node and cluster utilization |
| M5 | Availability risk | Single replica, missing probes, no HPA |
| M6 | Orphans | Scaled to zero and forgotten, or running with no identifiable owner |
| M7 | Tiering | The ownership inventory that prioritizes everything else, plus the list of untiered workloads split by squad |
| M8 | Early detection | Restarts and OOMKilled before they become an incident |
| M9 | Critical errors | Errors per workload and namespace, from logs |
| M10 | Control plane | Node health and conditions |
| M11 | Bottlenecks | CPU throttling and saturation |
| M12 | Compliance | The 8 SPECs of the AKS standard per workload: limits, requests, probes, non-root, Helm |
| — | Spend | Node inventory prorated per node-day |

Every module ships its own explanation inside the app: what it shows, why it matters and what to do with the result. The DQL query that ran is visible on every page.

---

## What makes it different: the ownership layer

Everything above is done, one way or another, by any FinOps tool. The difference is **how ArchorKube figures out who owns each workload**, because that's where the prioritization comes from.

It doesn't assume you have a service catalog. The ownership source is pluggable:

| Provider | When to use it |
|---|---|
| **Labels / annotations** | Your workloads are labeled. This is the default. |
| **Namespace convention** | The namespace is the team. Without governance, it's right more often than you'd think. |
| **Manual mapping** | Rules declared by hand. Always works; doubles as the exceptions list. |
| **No ownership** | Every analysis still runs; you only lose the grouping by team. |

And they **chain**, resolving field by field:

```ts
export const ownership = chainProviders(
  manualProvider(exceptions),   // first, the hand-made corrections
  labelsProvider,               // then whatever the workload itself says
  namespaceProvider,            // and failing that, at least the namespace
);
```

That matters because nobody arrives with 100% of their workloads labeled. A workload can get its squad from a label and its tier from a manual rule. And whatever nobody resolves **stays visible as *(no owner)*** instead of being assigned to someone at random — that row tends to be the most actionable finding of all.

The default convention builds on the recommended Kubernetes labels:

```yaml
metadata:
  labels:
    app.kubernetes.io/name: checkout-api
    app.kubernetes.io/part-of: payments
    archorkube.io/tier: "1"
    archorkube.io/owner: squad-payments
    archorkube.io/domain: commerce
```

If your organization already has its own keys (`team`, `cost-center`, `backstage.io/owner`…), you change them in one place and nothing needs relabeling. And if you have an IDP — Backstage, Port, a CMDB — you write a new provider: it's a four-method interface.

See [docs/OWNERSHIP.md](docs/OWNERSHIP.md) (Spanish).

---

## Getting started

Requires Node 24 and a Dynatrace tenant with Kubernetes monitoring.

```bash
git clone https://github.com/rdlook04/ArchorKube.git
cd ArchorKube/archor-kube
cp .env.example .env                                  # your tenant
cp ui/app/ownership/active.ts.example ui/app/ownership/active.ts   # your ownership provider(s)
cp ui/app/config/site.ts.example ui/app/config/site.ts             # your namespaces and prices
npm install
npm start
```

None of those three files is committed (they're in `.gitignore`) — they're configuration of your installation, not of the project.

**With an agent (Claude Code or similar), one minute.** Clone the repo, open the agent at the repo root and ask:

> Set up ArchorKube for my tenant `https://<my-tenant>.apps.dynatrace.com` following `docs/SETUP.md`, and validate it with the Setup tab.

The procedure is in [`docs/SETUP.md`](docs/SETUP.md); `AGENTS.md` and the `archorkube-setup` skill point to it. The agent discovers where your tenant keeps owners, which labels work as filters and which instance types need a price, and it's done when the **Setup** tab shows nothing as *Not working*. `dt-app` handles the login against your tenant in the browser the first time it starts; don't hand tokens to the agent.

To deploy it to your tenant:

```bash
npm run deploy
```

Before trusting the numbers, two things that depend on your environment:

1. **Check that labels arrive.** In a notebook: `describe dt.entity.cloud_application` and look for `cloudApplicationLabels` / `kubernetesAnnotations`. If they're not there, your operator isn't sending them — use the `manual` or `namespace` provider. (Careful: it is **not** `kubernetesLabels`; that field doesn't exist, and using it fails the whole query.)
2. **Set your prices.** The cost model ships with order-of-magnitude values. Your fleet's instance types and their prices go in `ui/app/config/site.ts`; without them, spend shows as unknown rather than miscalculated.

---

## Configuring

Four local files (three config files plus `.env`), and no more — each with its versioned `.example`:

| File | Copied from | What it decides |
|---|---|---|
| `ui/app/ownership/active.ts` | `active.ts.example` | Which ownership provider(s) are used, and in what order |
| `ui/app/ownership/port.ts` | `port.ts.example` (optional) | Your connector to your own catalog (Backstage, a CMDB…), if you have one |
| `ui/app/config/site.ts` | `site.ts.example` | Excluded namespaces, instance prices |
| `archor-kube/.env` | `.env.example` | Which tenant it points to |

None is committed. Any improvement outside these files is valid for everyone using the repo — that's the discipline that keeps the app generic instead of accumulating one organization's assumptions.

---

## Contributing

Welcome, and there are [open issues](../../issues) labeled `good first issue`.

The most useful thing you can contribute: **a new ownership provider**. If your organization resolves a workload's owner in a way that isn't here — Backstage, a CMDB, a naming convention, cloud tags — that adapter helps a lot of people. It's about 40 lines: implement `OwnershipProvider` in `ui/app/ownership/`.

The harness, before opening a PR:

```bash
npm run verify
```

---

## Status

Modules M1–M12 and the spend view are implemented and validated against a real production cluster. The app deploys and runs.

What is **not** solved, and is worth knowing before using it seriously:

- The name of the entity properties where labels and annotations live varies with the Kubernetes operator version. The labels provider is verified against a real tenant, but confirm it in yours with `describe`.
- The match between workload and catalog is by exact name. Names that don't match end up with no owner; there's no fuzzy matching.
- The cost model prorates CPU and memory 50/50. It's a reasonable approximation, not an invoice.

---

The app's UI and the module explanations are in Spanish. The code, its comments and the DQL are readable regardless; an English UI is a fair issue to open if you need one.
