# TVL Methodology

**Status:** Draft  
**Issue:** #29  
**Depends on:** #11

---

## 1. Purpose

This document defines how LumenMap calculates and reports Total Value Locked (TVL) at both the network level and the protocol level. Its goal is to produce figures that are comparable across protocols, free of double-counting, and transparently degraded when required data is missing or stale.

---

## 2. Network TVL vs Protocol TVL

These are two distinct metrics. They must never be combined or labeled interchangeably.

### 2.1 Network TVL

Network TVL is the aggregate value of all assets locked or held on the Stellar network at a given point in time. Hubble publishes this figure through the `crypto-stellar.crypto_stellar_dbt` dataset via account balances and pool reserves. It is a single, network-wide number.

- **Source:** Hubble (BigQuery, `crypto-stellar.crypto_stellar_dbt`)
- **Label in UI:** "Network TVL" or "Stellar Network TVL"
- **Must not be labeled:** "Protocol TVL", "dApp TVL", or any other protocol-scoped label

### 2.2 Protocol TVL

Protocol TVL is the value attributed to a specific protocol — for example, the assets held inside Soroswap's liquidity pools or anchored with MoneyGram. Protocol TVL is always a subset of network TVL and is assembled by LumenMap from per-protocol adapters.

- **Source:** Protocol-level adapters using Hubble data (see §4)
- **Label in UI:** "{Protocol Name} TVL" (e.g., "Soroswap TVL")
- **Aggregation:** Multiple protocol TVL figures can be summed to a "tracked protocol TVL" total, subject to the double-counting rules in §7

Network TVL ≥ tracked protocol TVL is a necessary invariant. If tracked protocol TVL exceeds network TVL for any asset, treat the figure as an error and emit `status: error`.

---

## 3. Eligible Protocols

A protocol is eligible for TVL tracking when all of the following are true:

1. It has at least one address (account or contract) in `data/entities.json` with a `protocol` field set.
2. It holds user assets in a deterministic on-chain position (liquidity pool, escrow contract, or custodial reserve).
3. A position type from §4 can be mapped to it.

A protocol that only routes value (e.g., a path-payment aggregator that does not hold reserves) is **not** eligible unless it also maintains a reserve pool.

New protocols are opted in explicitly by adding entries to `data/entities.json`. There is no automatic inclusion.

---

## 4. Eligible Position Types

Only positions that represent assets controlled by a protocol — not transient payment flows — are counted.

| Position type | Stellar mechanism | Included | Notes |
|---|---|---|---|
| AMM liquidity pool reserves | `liquidity_pool_deposit` / `liquidity_pool_withdraw` operations; `liquidity_pools` ledger state | **Yes** | Both assets in the pool pair are counted at their reserve balance |
| Soroban contract positions | Contract state read via Hubble or direct RPC | **Yes** | Only the contract's own held balance, not caller wallet balances |
| Anchor custodial reserves | Issuer account balances for pegged assets | **Yes** | Only for accounts in the entity registry with `category: anchor` |
| Issuer-held collateral | Assets held by asset issuer accounts | **Yes** | Only for accounts in the entity registry with `category: issuer` |
| Active buy/sell offers | `manage_buy_offer`, `manage_sell_offer` | **No** | Offers represent intent, not locked value |
| User wallet balances | Account native XLM or token balances | **No** | These belong to the user, not the protocol |
| In-flight payments | `payment`, `path_payment_*` | **No** | Transient; not locked |
| Trustlines | `change_trust` operations | **No** | A trustline authorizes, it does not lock value |
| Claimable balances | `create_claimable_balance` | **Conditional** | Included only if the claiming account belongs to the protocol in the entity registry |

If a position type is not listed in this table, it is **excluded** by default until this document is updated.

---

## 5. Snapshot Timing

### 5.1 Snapshot definition

TVL is a point-in-time balance, not a flow. Each snapshot is taken at **23:59:59 UTC** of the reporting day using ledger state as of that timestamp. The reporting day is the calendar day in UTC.

### 5.2 Frequency

TVL snapshots are computed daily. Intraday values are not reported to avoid confusion with volatile pool rebalancing.

### 5.3 Price-time alignment

Asset prices must be sourced from the same UTC day as the ledger snapshot. The price timestamp window is **00:00:00 UTC to 23:59:59 UTC** of the snapshot date. A price sourced from a different calendar day (UTC) is considered stale and must trigger the stale-price handling in §8.2.

If the last available price within the window is more than **4 hours old** relative to the snapshot timestamp, the position is flagged as `status: stale_price` (see §8).

---

## 6. Asset Pricing and USD Denomination

All TVL figures are reported in **USD**.

### 6.1 Price sources (priority order)

1. XLM/USD: Stellar DEX volume-weighted average price (VWAP) over the snapshot day, derived from `enriched_history_operations` `amount` fields for XLM pairs.
2. Token/XLM pairs: Stellar DEX VWAP for the token, converted to USD via the XLM/USD rate from (1).
3. Stablecoins pegged to USD (e.g., USDC, EURC): Use the declared peg value (1 USDC = 1 USD, 1 EURC = EUR/USD exchange rate). The EUR/USD rate follows the same staleness rules as any other price.
4. Tokens with no on-chain price data: reported as `status: no_price_data` (see §8.3).

### 6.2 Precision and rounding

- All intermediate calculations use full precision.
- Final TVL figures are rounded to 2 decimal places in USD.
- Asset quantities are stored in stroops (1 XLM = 10,000,000 stroops); divide by 10^7 before applying any price.

### 6.3 Native XLM in pool pairs

When a liquidity pool contains XLM as one side of the pair, the XLM reserve is priced at the snapshot-day VWAP (rule 1 above). The other asset is priced by its token/XLM pair (rule 2) independently. The two results are summed to get pool TVL.

---

## 7. Double-Counting Prevention and Attribution Rules

Double-counting occurs when the same locked asset is counted under more than one protocol or more than once under the same protocol. The following rules prevent it.

### 7.1 One position, one protocol

A position is attributed to **exactly one protocol**. Attribution is determined by the owner of the on-chain address that holds the position:

- For a liquidity pool: attributed to the protocol whose entity registry entry has `category: defi` and whose contract or known factory address created or manages the pool. If the pool was created by an address not in the entity registry, it is **unattributed** and excluded from protocol TVL.
- For an anchor/issuer reserve: attributed to the protocol whose entity registry entry owns that issuer account.
- For a Soroban contract: attributed to the protocol of the contract's entry in the entity registry.

If a single address appears in the entity registry under two different protocols, the entry is invalid and must be corrected before TVL is computed. The adapter must reject ambiguous entries and emit `status: error`.

### 7.2 Nested protocols

A nested protocol is one where Protocol B deposits assets into Protocol A (e.g., a yield optimizer that stakes LP tokens). Attribution follows the **innermost lock rule**: value is attributed to the protocol that physically holds the reserves.

- Protocol A (holds reserves) receives the TVL attribution.
- Protocol B (holds a claim on A's output) does **not** receive a separate TVL entry for the same underlying assets.
- If Protocol B has assets that are not otherwise locked in Protocol A (e.g., a fee reserve in its own contract), those assets are attributed to Protocol B separately.

### 7.3 Wrapped assets

A wrapped asset (e.g., wXLM, or a Soroban-wrapped Stellar asset) creates a new token backed 1:1 by the underlying. To avoid counting both the wrapper's reserve and the wrapper token in a pool:

- Count the **underlying reserve** held by the wrapper contract. Do not count the wrapped token separately.
- If a pool holds wrapped tokens, price them at the value of the underlying (not at a separate market price), and attribute the position to the pool's protocol.
- The wrapper contract itself is not a separate protocol entry unless it holds additional non-wrapped reserves.

### 7.4 Pooled assets (liquidity pools)

Both assets in a two-sided liquidity pool are counted once, summed as described in §6.3. LP tokens issued to liquidity providers are **not** counted as additional TVL — they represent a claim on the pool, not additional locked value.

### 7.5 Cross-protocol aggregation

When summing across protocols to produce a "tracked protocol TVL" total:

- Sum only positions that have `status: ok`.
- Exclude positions with `status: stale_price`, `status: no_price_data`, or `status: error`.
- The aggregate total must be labeled "Tracked Protocol TVL (partial)" when any positions are excluded due to non-ok status, so users know the figure is incomplete.
- Document the excluded positions and their statuses alongside the total.

---

## 8. Unsupported Cases, Stale Prices, and Confidence Indicators

No position is silently zeroed. Every position must produce an output with a `status` field.

### 8.1 Status values

| Status | Meaning |
|---|---|
| `ok` | Position was priced using a current price within the alignment window. TVL value is valid. |
| `stale_price` | A price was found but its timestamp is more than 4 hours before the snapshot timestamp. TVL value is present but flagged. |
| `no_price_data` | No price data is available for one or more assets in the position within the snapshot day. TVL value is `null`. |
| `missing_position` | The on-chain position could not be read (e.g., contract state unavailable, pool not found). TVL value is `null`. |
| `error` | An invariant was violated (e.g., ambiguous attribution, tracked TVL exceeds network TVL). TVL value is `null`. The error must be logged with a description. |

### 8.2 Stale price handling

A position with `status: stale_price` is included in the `stale` bucket, not in the `ok` bucket. The UI must render stale positions with a visible indicator (e.g., a warning icon and the staleness interval in hours). Stale positions are excluded from aggregation totals (see §7.5).

The last known price is retained in the output for display purposes and is clearly labeled "last known price" with its timestamp.

### 8.3 No price data

If no price data at all exists for an asset, the position's TVL value is `null`. The asset name and quantity are still reported so the operator can see what is unpriced. The position does not contribute to any aggregate total.

### 8.4 Partial protocol TVL

If a protocol has multiple positions and only some have `status: ok`, the protocol's reported TVL covers only the ok positions. The output must include a `partial: true` flag and a `missing` array listing position IDs that were excluded and their statuses.

---

## 9. Adapter Output Contract

Each protocol adapter must produce output conforming to this shape. This is the canonical format adapters must use so aggregation logic can verify totals from adapter outputs alone.

```typescript
interface PositionSnapshot {
  positionId: string;         // unique: "{protocolId}:{positionType}:{address}"
  protocolId: string;         // matches protocol field in entities.json
  positionType: "amm_pool" | "contract" | "anchor_reserve" | "issuer_reserve";
  address: string;            // on-chain address or pool ID
  assets: AssetBalance[];     // one entry per asset in the position
  tvlUsd: number | null;      // null when status !== "ok"
  status: PositionStatus;     // "ok" | "stale_price" | "no_price_data" | "missing_position" | "error"
  snapshotTimestamp: string;  // ISO 8601 UTC, e.g. "2025-01-15T23:59:59Z"
  priceTimestamp: string | null; // ISO 8601 UTC of the price used; null if no price
  staleness?: number;         // seconds between priceTimestamp and snapshotTimestamp; only when status === "stale_price"
  errorDetail?: string;       // human-readable description; only when status === "error"
  partial?: boolean;          // true if some assets in a multi-asset position are unpriced
  missing?: string[];         // asset IDs excluded from tvlUsd due to non-ok status
}

interface AssetBalance {
  assetCode: string;          // e.g. "XLM", "USDC", "yXLM"
  assetIssuer: string | null; // null for native XLM
  quantity: number;           // in asset units (not stroops)
  priceUsd: number | null;    // price per unit; null when no price available
  valueUsd: number | null;    // quantity * priceUsd; null when priceUsd is null
}

type PositionStatus = "ok" | "stale_price" | "no_price_data" | "missing_position" | "error";

interface ProtocolTvlOutput {
  protocolId: string;
  tvlUsd: number | null;      // sum of tvlUsd for all ok positions; null if all positions are non-ok
  partial: boolean;           // true if any positions were excluded
  missing: string[];          // positionIds that were excluded and their statuses
  positions: PositionSnapshot[];
  snapshotTimestamp: string;
}
```

Aggregation of a protocol's TVL from its adapter output is computed as:

```
protocolTvlUsd = sum(position.tvlUsd for position in positions where position.status === "ok")
```

This formula must be reproducible by anyone reading the adapter's raw output. No post-hoc adjustments are permitted.

---

## 10. Worked Examples

These examples verify the methodology against the acceptance criteria: each position has exactly one deterministic inclusion and attribution outcome.

### 10.1 Liquidity pool — Soroswap XLM/USDC pool

**Position:** Soroswap AMM pool `CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF` (entity registry entry: `protocol: Soroswap`, `category: defi`)

**Ledger state at snapshot (2025-01-15T23:59:59Z):**
- Reserve A: 500,000 XLM (native)
- Reserve B: 80,000 USDC (issuer: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`)

**Prices (snapshot-day VWAP):**
- XLM/USD: $0.12 (timestamp: 2025-01-15T22:00:00Z, within 4-hour window)
- USDC/USD: $1.00 (pegged stablecoin)

**Calculation:**
- XLM value: 500,000 × $0.12 = $60,000
- USDC value: 80,000 × $1.00 = $80,000
- Pool TVL: $140,000

**Attribution:** Soroswap (innermost holder of reserves)

**LP tokens held by users:** Not counted (represent claims on the pool, per §7.4)

**Output:**
```json
{
  "positionId": "soroswap:amm_pool:CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
  "protocolId": "soroswap",
  "positionType": "amm_pool",
  "address": "CA2TZIB56KYKD46F7IFBF6XPO5TDNK6N2U6BRTGZ5AF4WUSBN6BKZMGF",
  "tvlUsd": 140000.00,
  "status": "ok",
  "snapshotTimestamp": "2025-01-15T23:59:59Z",
  "priceTimestamp": "2025-01-15T22:00:00Z"
}
```

**Deterministic outcome:** Included under Soroswap. Not included under any other protocol. Not counted twice.

---

### 10.2 Wrapped asset — yXLM (Yield-bearing XLM wrapper)

**Scenario:** A hypothetical Soroban contract `CXXX...WRAPPER` holds 1,000,000 XLM as collateral and has issued 950,000 yXLM tokens to users. A Soroswap pool holds 200,000 yXLM / 25,000 USDC.

**Attribution (per §7.3):**

1. **Wrapper contract** (`CXXX...WRAPPER`): Holds 1,000,000 XLM.
   - TVL = 1,000,000 × $0.12 = $120,000. Attributed to the wrapper protocol.
   - The 950,000 yXLM in circulation are **not counted separately** — they are claims on the underlying.

2. **Soroswap pool holding yXLM/USDC:**
   - yXLM is priced at the value of its underlying: 1 yXLM = 1 XLM = $0.12 (not at a separate market price).
   - yXLM reserve: 200,000 × $0.12 = $24,000. Attributed to Soroswap.
   - USDC reserve: 25,000 × $1.00 = $25,000. Attributed to Soroswap.
   - Pool TVL: $49,000. Attributed to Soroswap.

**Note on double-counting:** The 200,000 XLM underlying the yXLM in the pool is already counted in the wrapper contract's $120,000. This is correct — the wrapper holds all 1,000,000 XLM, and the pool holds a yXLM claim worth 200,000 of them. Soroswap's TVL represents the pool's market value; the wrapper's TVL represents its collateral. These measure different things and belong to different protocols. They are **not** summed unless those protocols are both tracked and the user is explicitly told both figures contribute to the aggregate.

If the intent is to report "unique underlying XLM locked", the aggregation layer must be configured to de-duplicate by underlying asset across wrapper and pool — this is a display concern, not a per-adapter concern.

**Output (wrapper):**
```json
{
  "positionId": "yxlm-wrapper:contract:CXXX...WRAPPER",
  "protocolId": "yxlm-wrapper",
  "positionType": "contract",
  "address": "CXXX...WRAPPER",
  "tvlUsd": 120000.00,
  "status": "ok",
  "snapshotTimestamp": "2025-01-15T23:59:59Z",
  "priceTimestamp": "2025-01-15T22:00:00Z"
}
```

**Deterministic outcome:** Each position (wrapper collateral, pool) has exactly one attribution. The same XLM is not double-counted within a single protocol's TVL.

---

### 10.3 Nested protocol — yield optimizer depositing into Soroswap

**Scenario:** A yield optimizer protocol "YieldMax" (`CYYY...YIELD`, entity registry: `protocol: YieldMax`, `category: defi`) deposits LP tokens from Soroswap pools into its own vault contract to manage auto-compounding. YieldMax holds:
- 5,000 Soroswap LP tokens representing a share of the XLM/USDC pool
- 10,000 USDC in its own fee reserve

The Soroswap XLM/USDC pool total (from example 10.1) is $140,000. YieldMax's 5,000 LP tokens represent 10% of pool shares, so their underlying value is $14,000.

**Attribution (per §7.2, innermost lock rule):**

1. **Soroswap pool** holds the actual XLM and USDC reserves. TVL = $140,000. Attributed to **Soroswap**.
2. **YieldMax vault** holds LP tokens, which are claims on Soroswap's reserves. The underlying XLM/USDC is already counted under Soroswap. YieldMax does **not** receive a TVL entry for the $14,000 underlying — that would double-count.
3. **YieldMax fee reserve**: 10,000 USDC held directly in the YieldMax contract, not deposited anywhere else. This is a separate, unlocked asset. TVL = 10,000 × $1.00 = $10,000. Attributed to **YieldMax**.

**Output (YieldMax):**
```json
{
  "positionId": "yieldmax:contract:CYYY...YIELD",
  "protocolId": "yieldmax",
  "positionType": "contract",
  "address": "CYYY...YIELD",
  "tvlUsd": 10000.00,
  "status": "ok",
  "snapshotTimestamp": "2025-01-15T23:59:59Z",
  "priceTimestamp": "2025-01-15T22:00:00Z",
  "assets": [
    {
      "assetCode": "USDC",
      "assetIssuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "quantity": 10000,
      "priceUsd": 1.00,
      "valueUsd": 10000.00
    }
  ]
}
```

Note: YieldMax's LP token holdings are not represented in this output because they do not contribute to YieldMax's TVL (their underlying value is already captured by Soroswap). An adapter author must not create a position entry for held LP tokens of other protocols.

**Deterministic outcome:** Soroswap gets $140,000. YieldMax gets $10,000. The same reserves are not counted twice. Total tracked TVL across both = $150,000.

---

## 11. Out of Scope

The following are explicitly outside the scope of this document:

- Implementing a TVL query or Hubble adapter (implementation is tracked separately).
- Selecting the full set of protocols for the initial launch.
- Displaying TVL in the UI (tracked in the roadmap under Phase 3).
- Real-time or sub-daily TVL updates.
- Cross-chain TVL (e.g., bridged assets from other chains).

---

## 12. Relationship to Issue #11

Issue #11 covers adding payment volume (XLM and USDC flows) to LumenMap. TVL is complementary but distinct: payment volume measures throughput (how much value moved), while TVL measures stock (how much value is currently locked). The pricing infrastructure introduced for payment volume (#11) — specifically the XLM/USD and token/XLM VWAP calculation — is shared with and depended upon by this TVL methodology. TVL snapshots must not be computed until the price data pipeline from #11 is available.

---

## 13. Changelog

| Date | Change |
|---|---|
| 2026-07-29 | Initial draft (Issue #29) |
