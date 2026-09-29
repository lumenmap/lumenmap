# Contributing to LumenMap

Thank you for your interest in contributing. This guide covers everything you need to go from a fresh clone to an open pull request.

---

## Table of contents

- [Architecture overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Fixture mode vs live mode](#fixture-mode-vs-live-mode)
  - [Running fixture Flow demo](#running-fixture-flow-demo-without-gcp)
- [Project structure](#project-structure)
- [Available commands](#available-commands)
- [Making changes](#making-changes)
- [Hubble schema-drift incident playbook](#hubble-schema-drift-incident-playbook)
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

### Running fixture Flow demo (without GCP)

You can demo and develop the Flow visualization without GCP credentials or BigQuery access:

1. **Enable fixture mode:**
   Fixture mode is enabled automatically when no GCP credentials are set. To explicitly force fixture mode, set `LUMENMAP_DATA_SOURCE=fixture` in `.env.local` or pass it inline when starting the dev server:

   ```bash
   LUMENMAP_DATA_SOURCE=fixture npm run dev
   ```

2. **Open the Flow view:**
   Visit [`http://localhost:3000/?view=flow`](http://localhost:3000/?view=flow) in your browser. The page loads deterministic payment-flow fixtures without making external BigQuery requests.

3. **Interact with Flow components:**
   Explore Flow components such as `FlowDataTable` (table alternative to the canvas), test column sorting, keyboard navigation, and view switching.

4. **Verify Flow fixtures and components:**
   Run the following verification commands to ensure fixture and Flow integrity:

   ```bash
   npm run test:fixtures      # verifies fixture mode resolution and activity response
   npm run test:unit          # runs component unit tests (including FlowDataTable.test.tsx)
   npm run test:visual        # executes visual regression checks for Flow view
   npm run lint               # ensures linting passes
   ```

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
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Unit/integration tests |
| `npm run smoke` | Post-deploy smoke check |
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

## Hubble schema-drift incident playbook

Upstream Hubble tables in BigQuery can change without warning (for example, columns being renamed, removed, or struct definitions altered, such as the outage caused when `details` was removed from `enriched_history_operations`).

Before making SQL changes, review the [Hubble column contract](docs/hubble-column-contract.md) which lists all columns and queries in scope.

### ⚠️ The Health vs Activity split-brain symptom

LumenMap's readiness probe (`/api/health?type=readiness`) executes a lightweight connectivity check:
```sql
SELECT 1 AS ok
```
Because `/api/health` only validates BigQuery connectivity and local data file loading, **`/api/health` will report healthy (`200 OK`) even when a schema-drift incident has broken queries**. Meanwhile, `/api/activity` and `/api/v1/activity` execute full queries (like `activeDestinationCountQuery`) against `enriched_history_operations` and will fail with `500 Internal Server Error`.

This creates a split-brain condition where external uptime checks and deployment readiness probes report green while users experience broken cards or complete dashboard failures. **Never assume queries are functioning because `/api/health` returns 200.**

### Incident response steps

Follow these numbered steps to respond to a schema drift incident:

1. **Identify the failing query and missing column:**
   Check server logs or run `npm run smoke`. Look for BigQuery query syntax or column errors such as `Unrecognized name: <column>` or missing struct paths (e.g. `details.to`). Match the erroring SQL to the corresponding constant in `lib/hubble/shared-queries.mjs`.

2. **Audit current table schema with `INFORMATION_SCHEMA`:**
   Inspect current columns against the [Hubble column contract](docs/hubble-column-contract.md). If you have GCP credentials, verify the live schema:

   ```sql
   SELECT column_name, data_type, is_nullable
   FROM `crypto-stellar.crypto_stellar_dbt.INFORMATION_SCHEMA.COLUMNS`
   WHERE table_name = 'enriched_history_operations'
   ORDER BY ordinal_position;
   ```

3. **Apply emergency soft-fail mitigation (if applicable):**
   If the broken query is part of the `Promise.all` batch in `lib/hubble/activity.ts` and is non-critical, catch the error (e.g. `runQuery(...).catch(() => [])`) so that one broken query does not 500 the entire dashboard response while a permanent fix is prepared.

4. **Patch the query in `lib/hubble/shared-queries.mjs`:**
   Update the query string in `lib/hubble/shared-queries.mjs` (and any related query mappers in `lib/hubble/queries.ts`) to use the new column name or replacement aggregation logic.

5. **Dry-run the patched query:**
   Validate that BigQuery accepts the new SQL without incurring scan costs:

   ```bash
   bq query --dry_run --use_legacy_sql=false \
     --parameter='start::2026-09-01T00:00:00Z' \
     --parameter='end::2026-09-02T00:00:00Z' \
     "<SQL query>"
   ```

   If you do not have GCP access, note this in your PR description and request maintainer verification.

6. **Run required verification commands:**
   Confirm local tests and registry checks pass:

   ```bash
   npm run test:hubble:registry   # verify query registry is in sync
   npm run test:fixtures          # verify fixture mode is functional
   npm run test                   # run test suite
   npm run lint                   # verify ESLint passes
   ```

7. **Update fixtures and bump cache prefix:**
   - If the query response shape changed, update `lib/hubble/fixture.ts` to reflect the changes.
   - Bump the cache key prefix in `lib/hubble/activity.ts` (e.g., `activity:v10:` → `activity:v11:`) to invalidate stale or error responses in production caches.

8. **Update contract documentation and submit PR:**
   - Update `docs/hubble-column-contract.md` to reflect the updated columns.
   - Copy the PR checklist from `docs/hubble-column-contract.md` into your pull request.
   - Submit the PR with reference to the incident issue (`Closes #<issue>`).

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

## Code of Conduct

Please read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
