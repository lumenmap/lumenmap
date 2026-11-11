# Vercel Environment and Rollback Runbook

This runbook establishes the official maintainer procedure for managing Vercel environments, credential ownership, preview validation, health checks, data staleness verification, and instant deployment rollback for LumenMap.

---

## 1. Environment Variables Matrix

LumenMap relies on environment variables to authenticate with Google Cloud BigQuery (Hubble dataset) and tune server caching.

> [!IMPORTANT]
> Never record or commit secret values (such as raw JSON keys or base64 credential strings) into the repository. Environment variables must be configured through the Vercel Project Dashboard or local `.env.local` files.

| Variable | Environment | Format / Value Type | Default / Recommended | Purpose |
| --- | --- | --- | --- | --- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local | File path string (e.g., `./gcp-sa.json`) | None | Path to local GCP service account JSON key file for local development. |
| `GCP_SERVICE_ACCOUNT_KEY` | Preview, Production, Local | Base64-encoded string | None | Base64-encoded GCP Service Account JSON key. Required for Vercel serverless functions where local filesystem paths do not exist. |
| `CACHE_TTL_SECONDS` | Local, Preview, Production | Integer (seconds) | `900` (15 minutes) | Controls in-memory server cache TTL for BigQuery activity query results to manage BigQuery cost and rate limits. |
| `BIGQUERY_DAILY_BYTES_BUDGET` | Local, Preview, Production | Positive integer (bytes) | `53687091200` (50 GiB) | Trailing 24-hour BigQuery bytes-billed ceiling tracked in process and surfaced on `/api/health?type=readiness` and the dashboard burn line. |
| `BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT` | Local, Preview, Production | Integer (`1`–`100`) | `80` | Utilization percentage at which `/api/health?type=readiness` degrades `checks.bytesBilled` and emits structured `activity.query.budget_warning` logs without taking down core activity queries. |
| `BIGQUERY_DAILY_BUDGET_HARD_FAIL` | Local, Preview, Production | Boolean (`true` / `false`) | `false` | Optional hard guardrail: when `true` and the 24-hour budget is exhausted, optional non-critical enrichment queries (`transactionCategory`, `usdcCategory`, `usdcAccount`, `activeDestinationCount`, `activeContractCount`, `accountMetadata`) fast-fail so core treemap queries preserve remaining scan headroom. |

### Explicit Environment Differences

```text
+-----------------------+------------------------------------------+---------------------------------------------+
| Environment           | Credential Source                        | Cache TTL (`CACHE_TTL_SECONDS`)             |
+-----------------------+------------------------------------------+---------------------------------------------+
| Local Development     | GOOGLE_APPLICATION_CREDENTIALS file path | 900 (or lower for debugging)               |
|                       | or GCP_SERVICE_ACCOUNT_KEY               |                                             |
+-----------------------+------------------------------------------+---------------------------------------------+
| Vercel Preview        | GCP_SERVICE_ACCOUNT_KEY (Base64)         | 300 to 900 (allows fast preview validation) |
| (PRs & Branches)      | Staging/Preview GCP Service Account      |                                             |
+-----------------------+------------------------------------------+---------------------------------------------+
| Vercel Production     | GCP_SERVICE_ACCOUNT_KEY (Base64)         | 900 (15 minutes for BigQuery cost control)  |
| (Main branch)         | Production GCP Service Account           |                                             |
+-----------------------+------------------------------------------+---------------------------------------------+
```

---

## 2. Credential and Cache Configuration Ownership

- **Credential Ownership**: GCP Service Account credentials must be generated in the Google Cloud Console under a project with access to BigQuery dataset `crypto-stellar.crypto_stellar_dbt`. The service account requires the `BigQuery User` (or `BigQuery Data Viewer` + `BigQuery Job User`) role.
- **Access Control**: Only repository maintainers with **Admin** or **Owner** access to the Vercel project may add or update `GCP_SERVICE_ACCOUNT_KEY` in Vercel Project Settings.
- **Cache Management**: The in-memory cache (`CACHE_TTL_SECONDS`) mitigates query costs. In production, maintainers must ensure `CACHE_TTL_SECONDS` is set to `900` or higher to prevent excessive BigQuery execution fees during traffic spikes.

---

## 3. Preview Validation and Deployment Verification

Before promoting any change to production, validate the build in a Vercel Preview environment:

### Step 1: Automated Pull Request Preview
1. Open a Pull Request on GitHub. Vercel will automatically trigger a preview build.
2. Confirm that the Vercel deployment check on the PR passes with a green checkmark.

### Step 2: Smoke Check the Preview API
Execute a smoke check against the Preview URL generated by Vercel:

```bash
# Set your Vercel preview domain
PREVIEW_URL="https://lumenmap-git-your-branch-lumenmap.vercel.app"

# Test activity endpoint for 1-day period
curl -sS "${PREVIEW_URL}/api/activity?period=1d" | jq .
```

### Step 3: Validate API Payload Structure
Verify the returned JSON payload contains all required fields:
- `period`: `"1d"`
- `start` and `end`: Valid ISO 8601 timestamps
- `kpis`: `totalOps`, `sorobanShare`, `topCategory`, `activeContracts`
- `treemaps`: Contains `events` and `actors` root nodes
- `categories`, `contracts`, `accounts`, `sorobanFunctions`, `sorobanFunctionContracts`
- `usdcCategories`, `usdcAccounts`

---

## 4. Health, Failure, and Data-Staleness Checks

### Endpoint Health Check
- **Endpoint**: `GET /api/activity?period=1d`
- **Expected Status**: `200 OK`
- **Expected Content-Type**: `application/json`

### BigQuery Cost Budget Guardrail & Readiness Diagnostics
LumenMap tracks rolling and trailing 24-hour BigQuery bytes billed in process (`lib/hubble/bytes-billed-telemetry.ts`) and exposes budget burn on `/api/health?type=readiness` as well as the dashboard freshness footer (`data-testid="daily-burn-line"`):

```bash
curl -sS "${PREVIEW_URL}/api/health?type=readiness" | jq .checks.bytesBilled
```

- **Key Telemetry Fields**:
  - `dailyBytesBilled`: Bytes billed across the trailing 24 hours.
  - `dailyBytesRemaining`: Remaining bytes before hitting `dailyBytesBudget` (`0` once exhausted).
  - `dailyBytesBudget`: Configured 24-hour ceiling (`BIGQUERY_DAILY_BYTES_BUDGET`, default `50 GiB`).
  - `dailyBurnPercent` / `softWarnPercent`: Current burn ratio vs soft warning threshold (`BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT`, default `80%`).
  - `dailyBurnLine`: Human-readable burn summary (`Daily BigQuery burn: X.XX GB / Y.YY GB (Z.Z% · ~$U.UU)`).
- **Soft Warning vs Optional Hard-Fail**:
  - Crossing `BIGQUERY_DAILY_BYTES_SOFT_WARN_PERCENT` (or `100%` of `BIGQUERY_DAILY_BYTES_BUDGET`) marks `checks.bytesBilled.status` as `"degraded"` (`HTTP 200` with `status: "degraded"`) and logs `activity.query.budget_warning` **without taking down core activity queries by default**.
  - Operators who want automatic load-shedding during traffic spikes can set `BIGQUERY_DAILY_BUDGET_HARD_FAIL=true` in Vercel Environment Variables so optional non-critical queries (`transactionCategory`, `usdcCategory`, `usdcAccount`, `activeDestinationCount`, `activeContractCount`, `accountMetadata`) fast-fail via `runOptionalQuery` once `dailyBytesRemaining` reaches `0`, while core treemap queries remain online.
  - To reduce sustained burn, raise `CACHE_TTL_SECONDS` (e.g., `1800`), enable materialized rollups (`LUMENMAP_USE_ROLLUPS=true`), or adjust `BIGQUERY_DAILY_BYTES_BUDGET` to match project quota.

### BigQuery Credential Failure Diagnostics
If `GCP_SERVICE_ACCOUNT_KEY` is missing or corrupted:
- **HTTP Status**: `500 Internal Server Error`
- **JSON Error Output**:
  ```json
  {
    "error": "BigQuery credentials are required. Set GOOGLE_APPLICATION_CREDENTIALS in .env.local"
  }
  ```
- **Remediation**: Re-encode the GCP service account JSON key using base64 and update `GCP_SERVICE_ACCOUNT_KEY` in Vercel Environment Variables:
  ```bash
  base64 -i gcp-sa.json | tr -d '\n'
  ```

### Data-Staleness Verification
Hubble data updates in intraday batches on BigQuery. To verify data freshness:
1. Fetch `/api/activity?period=1d`.
2. Inspect `end` timestamp in the response. It should match the current date/time within standard intraday refresh latency.
3. If data appears stale, verify that the server cache key is expiring properly (`CACHE_TTL_SECONDS`) and that Next.js route `/api/activity/route.ts` specifies `export const dynamic = "force-dynamic"`.

---

## 5. Rollback & Incident Recovery Runbook

When a production incident occurs (e.g., runtime 500 errors, broken treemap rendering, or failed BigQuery integrations), follow this rollback procedure.

### Known-Good Deployment Rollback Paths

#### Option A: Instant Rollback via Vercel Dashboard (Recommended - < 1 minute)
1. Log into [Vercel Dashboard](https://vercel.com).
2. Select the **LumenMap** project.
3. Navigate to the **Deployments** tab.
4. Locate the last **Production** deployment that was known to be healthy prior to the incident.
5. Click the **`...`** (overflow menu) next to the target deployment and select **Instant Rollback** (or **Promote to Production**).
6. Confirm the prompt. Production traffic will immediately be routed to the selected deployment artifact.

#### Option B: Instant Rollback via Vercel CLI
If CLI access is available:

```bash
# Link to project if needed
vercel link

# Execute instant rollback to previous deployment
vercel rollback <known-good-deployment-id-or-url>
```

#### Option C: Repository Git Revert (Permanent Fix Path)
To permanently revert the codebase on `main`:

```bash
git checkout main
git pull origin main
git revert HEAD -m "revert: rollback broken production deployment"
git push origin main
```

---

## 6. Post-Rollback Verification Checklist

Immediately after initiating a rollback, complete the following verification steps:

- [ ] **HTTP 200 Verification**: Run `curl -i -sS https://<production-domain>/api/activity?period=1d` and confirm `HTTP/2 200`.
- [ ] **UI Treemap Verification**: Open `https://<production-domain>` in a browser and confirm:
  - Treemap tiles render correctly for both "Operation Types" and "Accounts & Contracts".
  - Metric switching between "Operation Count" and "USDC Volume" functions without errors.
  - Detail panel updates when clicking tiles.
- [ ] **Log Inspection**: Check Vercel Function Logs under **Vercel Dashboard -> Logs** to ensure zero server-side exceptions or unhandled promise rejections.
- [ ] **Incident Communication**: Document the incident root cause, rollback deployment ID, and remediation steps in an incident issue.
