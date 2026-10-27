# Contributing to LumenMap

Thank you for your interest in contributing. This guide covers everything you need to go from a fresh clone to an open pull request.

---

## Table of contents

- [Architecture overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Fixture mode vs live mode](#fixture-mode-vs-live-mode)
  - [Running fixture Flow demo](#running-fixture-flow-demo-without-gcp)
- [Onboarding when live data fails](#onboarding-when-live-data-fails)
- [Project structure](#project-structure)
- [Available commands](#available-commands)
- [Making changes](#making-changes)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Address list import fixture](#address-list-import-fixture)
- [Entity registry](#entity-registry)
- [Issue sizing (Wave estimate guide)](#issue-sizing-wave-estimate-guide)
- [Branch and PR workflow](#branch-and-pr-workflow)
- [Changelog workflow](#changelog-workflow)
- [Soft real-time freshness channel (SSE)](#soft-real-time-freshness-channel-sse)
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

## Address list import fixture

Use [`data/fixtures/watchlist-import.csv`](data/fixtures/watchlist-import.csv)
to check the dashboard watchlist's **Import CSV/TXT** control in fixture mode.
The CSV format accepts an `address` header in any column, or uses the first
column when there is no header. TXT accepts one Stellar `G…` or `C…` address per
line. Other CSV columns are ignored. The sample includes two accepted rows and
one invalid row so the skip message is easy to verify. The watchlist holds at
most 20 entries, and **Clear imported** removes only entries added by import.

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

### Onboarding when live data fails

If you have configured GCP credentials but the live Hubble query fails (expired key, missing BigQuery permissions, network issues), the dashboard shows an error state. In local development this error state includes an onboarding panel that explains how to fall back to fixture mode so you can keep working on the UI.

To enable fixture mode after a live failure:

1. Comment out or remove `GOOGLE_APPLICATION_CREDENTIALS` and `GCP_SERVICE_ACCOUNT_KEY` in `.env.local`.
2. Restart the dev server (`npm run dev`).
3. Reload the dashboard — the API will return fixture data with `"fixture": true`.

The onboarding panel links back to this section. It is only rendered when `NODE_ENV` is not `production`, so production deployments never surface fixture instructions to end users.

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
| `npm run entities:validate` | Check curated entity addresses and required fields |
| `npm run test:entities` | Exercise valid and invalid entity fixtures |

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

SQL depends on upstream Hubble columns that nothing in the app validates. Read
the [Hubble column contract](docs/hubble-column-contract.md) before editing a
query: it lists every column each query reads, the known drift hazards, the
`INFORMATION_SCHEMA` / dry-run commands to confirm a column still exists, and a
checklist to paste into your PR.

1. Edit queries in `lib/hubble/queries.ts` or `lib/hubble/activity.ts`.
2. Confirm the columns you reference still exist (see the contract doc), then
   test against live data:

   ```bash
   npm run test:hubble
   npm run test:hubble:registry
   ```

3. If you change the shape of the response, update `lib/hubble/fixture.ts` to match so fixture mode stays representative.

4. If a live query fails during development, follow [Onboarding when live data fails](#onboarding-when-live-data-fails) to switch back to fixture mode.

5. Bump the cache key prefix in `lib/hubble/activity.ts` (e.g. `activity:v10:` → `activity:v11:`) to avoid serving stale cached responses to existing instances.

### Updating entity labels

After gathering the [proposal evidence](#proposing-a-label), add or correct a wallet or contract label in [`data/entities.json`](data/entities.json):

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

## Keyboard shortcuts

Dashboard shortcuts are defined once in [`lib/shortcuts.ts`](lib/shortcuts.ts)
and listed in the README's [Keyboard shortcuts](README.md#keyboard-shortcuts)
table. When you add or change a shortcut:

1. Update `SHORTCUT_GROUPS` / `SHORTCUT_KEYS` in `lib/shortcuts.ts` (the `?`
   overlay renders from them).
2. Update the handler in
   `components/dashboard/KeyboardShortcuts.tsx` (or the owning widget for
   widget-scoped keys).
3. Update the README table and the tests in
   `components/dashboard/KeyboardShortcuts.test.tsx`.

---

## Entity registry

LumenMap labels addresses using two sources, merged at startup:

| File | Source | Edit how |
| --- | --- | --- |
| `data/entities.json` | Hand-curated | Edit directly |
| `data/directory.json` | Stellar Expert | `npm run sync:directory` |

Entries in `entities.json` override `directory.json` for the same address. Use `entities.json` for corrections and additions that Stellar Expert does not yet carry.

Valid categories: `defi`, `exchange`, `wallet`, `anchor`, `issuer`, `other`.

### Proposing a label

Open an [Entity Label Proposal](.github/ISSUE_TEMPLATE/entity_label_proposal.yml) issue before changing `data/entities.json`, or include the same evidence in the entity review section of your PR. Provide the full G account or C contract address and network, proposed `name`, `category`, and `protocol`, an explorer link for the exact address, and a public source controlled by the operator (official site, docs, or signed announcement) that connects that address to the name. Explain corrections to existing labels. Reviewers check the links and the address-to-name relationship manually; the validator only checks registry structure.

Use the public name supported by the evidence, not a vanity name or an inferred owner. A proposal can be rejected for an invalid or duplicate address, missing fields, unsupported category, broken or unrelated proof links, a name that the sources do not verify, or a correction without a reason. A directory label alone is not proof of control. Do not add a label while ownership is ambiguous.

Keep `data/entities.json` as an address-keyed object with non-empty `name`, `category`, and `protocol` strings. Run `npm run entities:validate` before submitting. The command accepts an optional path to validate another JSON file, for example `npm run entities:validate -- path/to/entities.json`. It checks 56-character uppercase base32 G/C address shape; human review establishes address ownership and on-chain provenance.

---

## Protocol TVL adapter registry

The Protocol TVL treemap (`metric: "tvl"`) is built from `lib/tvl/protocol-registry.ts`. By default every protocol uses a fixture adapter (`lib/tvl/adapter.ts`'s `ExampleTvlAdapter`) so the treemap works with no external credentials. A protocol can instead use a real, live adapter.

### Adding a live adapter

1. Add a class implementing the `ProtocolTvlAdapter` contract (`lib/tvl/adapter.ts`) under `lib/tvl/live-adapters/`. It must resolve to a `TvlAdapterResult` — including a `"failed"` result on any error — and must not throw. See `lib/tvl/live-adapters/defillama-tvl-adapter.ts` for a working example backed by DefiLlama's free public API.
2. Register it in `LIVE_ADAPTER_FACTORIES` in `lib/tvl/protocol-registry.ts`, keyed by the protocol's lowercase id (its fixture's `protocol` name, lowercased).
3. Enable it locally by setting `LUMENMAP_TVL_LIVE_ADAPTERS` in `.env.local` to a comma-separated list of ids, e.g. `LUMENMAP_TVL_LIVE_ADAPTERS=soroswap`.
4. Run the tests:

   ```bash
   npm test
   ```

An id with no registered factory, or with the environment variable unset, is a no-op — that protocol keeps using its fixture. No other file needs to change: `buildAllTreemaps`, `buildProtocolTvlTreemap`, and the `ProtocolTvlAdapter` contract are unaffected by adding or removing a live adapter.

### Error isolation

`fetchProtocolTvlResults` isolates every adapter individually (`Promise.allSettled`): if one adapter throws, it is converted to a `"failed"` result rather than rejecting the whole call. `buildProtocolTvlTreemap` renders every result as a tile, including `"failed"` and `"unsupported"` ones, at zero value — so a broken live adapter shows up as a visibly failed tile, and never removes other protocols' tiles or crashes the page.

### Note on TVL methodology

A live adapter that only reports a number from an external aggregator (like the DefiLlama example) does not follow the Hubble-native snapshot, pricing, and double-counting rules in [`docs/tvl-methodology.md`](docs/tvl-methodology.md) — that document describes a Stellar-ledger-derived adapter, which is tracked separately. Say so in the adapter's own doc comment if it doesn't.

---

## Issue sizing (Wave estimate guide)

Every Stellar Wave issue should carry one `size:S`, `size:M`, or `size:L` label so contributors can gauge effort before picking one up. A maintainer (or the issue author) applies the label when the issue is filed or triaged.

| Label | Typical shape | Signals |
| --- | --- | --- |
| `size:S` | A handful of files, one focused change | No BigQuery/schema change. No new route or subsystem. Little to no new a11y surface (editing an existing accessible component, not introducing one). Usually a helper, a docs update, or a small parsing/formatting fix. |
| `size:M` | A new component, route, or panel plus its tests and docs | May touch one existing data path but doesn't change its contract. Introduces a bounded new a11y surface (one dialog, one chart, one toggle) that needs keyboard/labeling work. Typically the shape of a single self-contained Wave feature issue. |
| `size:L` | A new subsystem, pipeline, or cross-cutting infra change | BigQuery/Hubble schema or query changes, new build tooling (Storybook, visual-regression baselines), or a feature whose a11y/testing surface spans multiple existing components. Expect more than one review round. |

This is a judgment call, not a formula — intentionally no automated/ML sizing. When unsure, size up: a `size:M` issue that turns out small is a pleasant surprise; a `size:S` issue that turns out to need a schema change is a stalled PR.

Size labels are independent of the `good first issue` label — a `size:S` issue is not automatically beginner-friendly if it requires deep familiarity with a specific subsystem (e.g. the Hubble query layer).

`scripts/backfill-wave-size-labels.mjs` applies this guide to a batch of already-open `Stellar Wave` issues; see the script's header comment for usage and for the judgment notes behind each sizing decision it was seeded with.

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

## Changelog workflow

Use conventional commit subjects for public API and UI changes so release notes
can be generated without a GitHub token or another service:

```text
feat(api): expose protocol freshness metadata
fix(ui): keep the period selector visible at high zoom
docs(methodology): clarify incomplete-period coverage
```

`feat`, `fix`, and `docs` commits become the **Added**, **Fixed**, and
**Documentation** sections. Merge commits and maintenance-only commit types are
ignored. Entries retain oldest-first Git order and link to their exact commit,
so the same range always produces the same Markdown.

Preview a known range without changing a file:

```bash
npm run changelog:generate -- --from <base-sha-or-tag> --to <head-sha-or-tag>
```

Maintainers can update only the generated block under `Unreleased` after
reviewing the preview:

```bash
npm run changelog:generate -- --from <last-release> --to HEAD --write
npm run test:changelog
```

For a deterministic credential-free example, use the committed fixture:

```bash
npm run changelog:generate -- --fixture scripts/fixtures/changelog-commits.json
```

Do not hand-edit text between the generated markers. Curated release summaries
outside those markers remain untouched.

---

## Soft real-time freshness channel (SSE)

LumenMap caches Hubble query results in-memory with a 15-minute TTL. To keep persistent dashboard tabs fresh without full-page reloads, heavy WebSockets, or continuous polling, the server provides a lightweight Server-Sent Events (SSE) stream.

### Endpoint & Protocol
- **Route**: `GET /api/v1/events/freshness`
- **Protocol**: HTTP/1.1 or HTTP/2 Server-Sent Events (`Content-Type: text/event-stream; charset=utf-8`).
- **Authentication**: Authless, public endpoint.
- **Headers**:
  - `Cache-Control: no-cache, no-transform, no-store, must-revalidate`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no` (disables intermediate reverse proxy buffering)

### Event Payload Schema
Whenever the backend cache rotates or invalidates (e.g. `setCache` / `clearCache`), a `freshness` event is emitted:
```text
event: freshness
data: {"epoch":1774191600000,"generatedAt":"2026-10-22T14:40:00.000Z","keys":["activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z"],"reason":"cache_set"}
```

- `epoch`: Millisecond timestamp representing the current cache generation.
- `generatedAt`: ISO 8601 string of the rotation event.
- `keys`: Array of cache keys that were rotated (e.g., `activity:v14:<network>:<period>:<start>`).
- `reason`: One of `"initial"` (immediate connection snapshot), `"cache_set"`, or `"cache_clear"`.

### Heartbeats, Limits & Reconnection
- **Heartbeat Comments**: Every 25 seconds, `: ping\n\n` comments are sent down the wire to prevent edge routers, cloud load balancers, and firewalls from dropping idle TCP connections.
- **Max Connection Lifetime**: The server gracefully closes connections after 5 minutes (`MAX_CONNECTION_LIFETIME_MS = 300_000`). Native browser `EventSource` automatically reconnects seamlessly.
- **Client Debouncing**: The `useFreshnessStream` hook coalesces events within a 2-second debounce window (`debounceMs = 2000`) before invalidating TanStack Query activity queries. This prevents duplicate refetch storms when multiple cache entries update concurrently.
- **Selective Query Invalidation**: Events specifying affected cache keys only invalidate queries matching the currently active `period` and `network`.
- **Fallback Polling**: If `EventSource` is unsupported in the client browser or if connections are blocked, the client automatically falls back to periodic polling every 5 minutes (`fallbackPollingIntervalMs = 300_000`).

### Manual Verification in DevTools
1. Run the local development server:
   ```bash
   npm run dev
   ```
2. Open Chrome/Firefox DevTools (`F12`), navigate to the **Network** tab, and filter by `freshness` or `EventStream`.
3. Load `http://localhost:3000/`.
4. Inspect the `GET /api/v1/events/freshness` request:
   - Status: `200 OK`
   - Type: `eventsource`
5. Switch to the **EventStream** tab in DevTools:
   - Observe the initial `freshness` event with `"reason": "initial"`.
   - Observe periodic comment pings (`: ping`).
6. Trigger a cache rotation in another terminal:
   ```bash
   curl -s "http://localhost:3000/api/v1/activity?period=1d" > /dev/null
   ```
7. Verify that a new `freshness` event appears in the DevTools EventStream and that the TanStack Query activity query invalidates cleanly without a full-page reload.

---

## Pull request expectations

- **Title:** Short and specific, under 70 characters. Bad: `Updates`. Good: `Add fixture mode for credential-free development`.
- **Description:** Explain what changed and why. Mention the issue it closes with `Closes #<number>`.
- **Scope:** Keep PRs small and focused. A PR that does one thing is faster to review and easier to revert.
- **Lint:** `npm run lint` must pass with no errors.
- **Partial-failure behavior:** Queries that feed `/api/v1/activity` are fetched in one batch, so a single failing subquery can take the whole response down. If your PR touches a query or API route, fill in the *API partial-failure behavior* section of the PR template: mark each query **required** or **optional**, and make optional ones fail soft (`runQuery(...).catch(() => [])` in `lib/hubble/activity.ts`) instead of rejecting the batch.
- **Query changes:** Run `npm run test:hubble` and include the output in the PR description. If you do not have GCP access, note that clearly and ask a maintainer to verify.
- **Fixture data:** If you add or rename response fields, update `lib/hubble/fixture.ts` to reflect the new shape.
- **Fixture onboarding:** The dev-only onboarding panel must never render in production builds. Verify with a component test that toggles `NODE_ENV` between `development` and `production`.
- **Entity additions:** Small additions to `data/entities.json` can be bundled into a single PR. Large batch updates should be their own PR.
- **No credentials in commits:** Double-check that `gcp-sa.json` and `.env.local` are not staged.

---

## Questions

Open an issue or start a discussion on [github.com/lumenmap/lumenmap](https://github.com/lumenmap/lumenmap).

## Code of Conduct

Please read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
