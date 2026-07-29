# Contributing to LumenMap

Thank you for your interest in contributing. This guide covers everything you need to go from a fresh clone to an open pull request.

---

## Table of contents

- [Architecture overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Fixture mode vs live mode](#fixture-mode-vs-live-mode)
- [Project structure](#project-structure)
- [Available commands](#available-commands)
- [Making changes](#making-changes)
- [Entity registry](#entity-registry)
- [Branch and PR workflow](#branch-and-pr-workflow)
- [Pull request expectations](#pull-request-expectations)

---

## Architecture overview

```text
Browser
  → GET /api/activity?period=1d|7d|30d|month
  → app/api/activity/route.ts
      → no credentials → lib/hubble/fixture.ts   (fixture mode)
      → credentials present → lib/hubble/activity.ts
          → BigQuery (Hubble dataset)
          → in-memory cache, 15 min TTL
          → lib/entities/build-treemap.ts
  → components/dashboard/DashboardProvider.tsx   (TanStack Query)
  → components/dashboard/                        (React + D3)
```

The API has two modes. **Fixture mode** returns hardcoded sample data so the dashboard is fully functional without a GCP account. **Live mode** queries the [Hubble](https://developers.stellar.org/docs/data/analytics/hubble) dataset on BigQuery.

---

## Prerequisites

- **Node.js 20+** (check with `node -v`)
- **npm** (bundled with Node.js)
- **GCP credentials** — only needed for live Hubble data, not for fixture mode

---

## Getting started

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/lumenmap.git
cd lumenmap

# 2. Install dependencies
npm install

# 3. Copy the environment template
cp .env.example .env.local

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard loads immediately using fixture data — no GCP setup required.

---

## Fixture mode vs live mode

### Fixture mode (default, no credentials needed)

When neither `GOOGLE_APPLICATION_CREDENTIALS` nor `GCP_SERVICE_ACCOUNT_KEY` is set in `.env.local`, the API returns static sample data from [`lib/hubble/fixture.ts`](lib/hubble/fixture.ts). The response includes `"fixture": true` so you can tell at a glance which mode is active.

Fixture mode is sufficient for:

- Front-end layout and component work
- Treemap interaction and drill-down
- Entity registry additions
- Anything that does not involve query logic or real network numbers

### Live mode (requires GCP)

To query real Hubble data you need a Google Cloud project with the BigQuery API enabled and a service account with the **BigQuery User** role.

1. Create a service account and download the JSON key.
2. Add it to `.env.local`:

   ```env
   # Option A — local file path
   GOOGLE_APPLICATION_CREDENTIALS=./gcp-sa.json

   # Option B — base64-encoded JSON (useful for CI and deployment)
   # GCP_SERVICE_ACCOUNT_KEY=<base64-string>
   ```

3. Restart the dev server. The API will now query Hubble and the response will not contain `"fixture": true`.

Hubble setup guide: [Connecting to BigQuery](https://developers.stellar.org/docs/data/analytics/hubble/developer-guide/connecting-to-bigquery).

> **Do not commit `gcp-sa.json` or `.env.local`.** Both are in `.gitignore`. Each contributor uses their own credentials.

---

## Project structure

```text
app/
  page.tsx                     Entry point
  layout.tsx
  api/activity/route.ts        GET /api/activity — fixture or live
  globals.css

components/dashboard/
  DashboardPage.tsx            Root dashboard component
  DashboardProvider.tsx        TanStack Query + shared state
  D3Treemap.tsx                Squarified D3 treemap
  NetworkTreemap.tsx           Treemap wrapper with drill-down
  KpiCards.tsx                 KPI strip
  DetailPanel.tsx              Right-side detail panel
  PeriodSelector.tsx           1d / 7d / 30d / month toggle
  TreemapViewSelector.tsx      Operation Types / Accounts view toggle
components/ui/                 Generic UI primitives (button, card, …)
components/providers.tsx       React Query provider

lib/
  types.ts                     Shared TypeScript types
  constants.ts                 Category colours, group labels, query limits
  periods.ts                   Period resolution (start/end date logic)
  utils.ts                     Shared helpers
  hubble/
    activity.ts                Orchestrates BigQuery queries and caching
    client.ts                  BigQuery client + hasBigQueryCredentials()
    cache.ts                   In-memory cache with TTL
    queries.ts                 SQL query strings and row mappers
    fixture.ts                 Static sample data for fixture mode
  entities/
    registry.ts                Loads entities.json + directory.json
    resolve-labels.ts          Fetches home_domain labels from Hubble
    build-treemap.ts           Converts raw rows into treemap nodes

data/
  entities.json                Hand-curated wallet and contract labels
  directory.json               Synced from Stellar Expert directory

scripts/
  test-hubble-queries.mjs      Smoke-tests all BigQuery queries
  sync-stellar-directory.mjs   Pulls latest labels from Stellar Expert
```

---

## Available commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Production server (run `build` first) |
| `npm run lint` | ESLint — run before every PR |
| `npm run test:hubble` | Smoke-tests all BigQuery queries (requires GCP) |
| `npm run sync:directory` | Pulls entity labels from Stellar Expert |

---

## Making changes

### Front-end only changes

No GCP credentials needed. Start the dev server and work directly:

```bash
npm run dev
# edit components/, lib/, or data/ freely
npm run lint       # check before committing
```

### Query changes (requires GCP)

1. Edit queries in `lib/hubble/queries.ts` or `lib/hubble/activity.ts`.
2. Test against live data:

   ```bash
   npm run test:hubble
   ```

3. If you change the shape of the response, update `lib/hubble/fixture.ts` to match so fixture mode stays representative.

4. Bump the cache key prefix in `lib/hubble/activity.ts` (e.g. `activity:v10:` → `activity:v11:`) to avoid serving stale cached responses to existing instances.

### Updating entity labels

To add or correct a wallet or contract label, edit [`data/entities.json`](data/entities.json) directly:

```json
{
  "G...": { "name": "My Protocol", "category": "defi", "protocol": "My Protocol" }
}
```

To pull the latest names from the Stellar Expert directory:

```bash
npm run sync:directory
```

This overwrites `data/directory.json`. Commit both the script run and any manual changes to `entities.json` together.

---

## Entity registry

LumenMap labels addresses using two sources, merged at startup:

| File | Source | Edit how |
| --- | --- | --- |
| `data/entities.json` | Hand-curated | Edit directly |
| `data/directory.json` | Stellar Expert | `npm run sync:directory` |

Entries in `entities.json` override `directory.json` for the same address. Use `entities.json` for corrections and additions that Stellar Expert does not yet carry.

Valid categories: `defi`, `exchange`, `wallet`, `anchor`, `issuer`, `other`.

---

## Branch and PR workflow

1. **Check or open an issue** before starting non-trivial work. Comment on the issue to signal you are working on it.

2. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/short-description
   # or
   git checkout -b fix/short-description
   ```

   Use `feat/`, `fix/`, `chore/`, or `docs/` prefixes.

3. **Make focused commits.** One logical change per commit is easier to review than a single large commit.

4. **Lint before pushing:**

   ```bash
   npm run lint
   ```

5. **Push your branch and open a PR:**

   ```bash
   git push -u origin feat/short-description
   ```

   Then open a pull request on GitHub targeting `main`.

---

## Pull request expectations

- **Title:** Short and specific, under 70 characters. Bad: `Updates`. Good: `Add fixture mode for credential-free development`.
- **Description:** Explain what changed and why. Mention the issue it closes with `Closes #<number>`.
- **Scope:** Keep PRs small and focused. A PR that does one thing is faster to review and easier to revert.
- **Lint:** `npm run lint` must pass with no errors.
- **Query changes:** Run `npm run test:hubble` and include the output in the PR description. If you do not have GCP access, note that clearly and ask a maintainer to verify.
- **Fixture data:** If you add or rename response fields, update `lib/hubble/fixture.ts` to reflect the new shape.
- **Entity additions:** Small additions to `data/entities.json` can be bundled into a single PR. Large batch updates should be their own PR.
- **No credentials in commits:** Double-check that `gcp-sa.json` and `.env.local` are not staged.

---

## Questions

Open an issue or start a discussion on [github.com/lumenmap/lumenmap](https://github.com/lumenmap/lumenmap).
