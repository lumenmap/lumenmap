# ADR: Wallet-cluster and payment-flow visualization architecture

**Status:** Accepted  
**Date:** 2026-10-01  
**Author:** LumenMap Team  

## Context

LumenMap's signature surface is a hierarchical treemap showing network activity aggregated by operation type and accounts/contracts. Contributors need a complementary Bubblemaps-style wallet cluster and payment-flow view to answer questions about value transfer between accounts.

This view must:
- Show value movement as a directed graph (ego network + top edges, not full-chain crawl)
- Coexist cleanly with the existing treemap architecture
- Have clear conventions for node identity, edge semantics, and API boundaries
- Support contributor onboarding via fixtures before BigQuery access

Currently, no architecture decision covers:
- How nodes and edges are identified and sampled
- API shape and versioning strategy for the `/api/v1/flow` endpoint
- Rendering constraints for web graphs (canvas vs SVG, accessibility, reduced motion)
- How contributors start building without GCP credentials

## Decision

### Product goal

The Flow view visualizes **ego-network transfers**: successful, amount-bearing operations between accounts in a selected period. It answers "who is paying whom?" and "what assets flow through this account?" It is **not** a full blockchain transaction ledger or mempool watcher.

**Out of scope for v1:**
- Real-time mempool monitoring
- Cross-asset USD normalization or pricing
- Settlement verification or finality tracking

### Node and edge identity

**Nodes:** One Stellar classic account ID (`G...` address) that is the source or destination of at least one rendered edge in the period. A node persists even if its edges are filtered, so an empty-result account selection still displays that account's node.

**Edges:** Directed transfers aggregated from successful operations:
- **Operation types included:** `payment`, `path_payment_strict_send`, `path_payment_strict_receive`, `create_account` (funding), `account_merge` (drain)
- **Collapse rule:** Operations matching the same `(source_account, destination_account, asset_identity)` collapse into one edge, summing `amount` and `operation_count`
- **Asset identity:** For native XLM, use explicit `(asset_type='native')` regardless of null code/issuer. For issued assets, require non-empty `(asset_code, asset_issuer)` and keep both together. No cross-asset summation.
- **Exclusions:** Failed operations, self-payments, missing source/destination fields, and other operation types

**Sampling and top-N rule:**
- Rank all edges by `operation_count` DESC, then by `amount` DESC within the same asset
- Return top 100 edges per query
- Set `sampled: true` when more edges exist; absent edges may be outside the sample, not absent from the network
- Asset mode (e.g., XLM-only filter) applies ranking before capping

**Amount completeness:** For funding and drain operations, Hubble may not provide a reliable amount. Mark such edges `amountComplete: false`; clients suppress the amount display and show an em dash instead.

### API boundary: `/api/v1/flow`

**Query parameters:**
- `period` (required): `1d` | `7d` | `30d` | `month` (validates per `lib/periods.ts`)
- `network` (optional, default `mainnet`): `mainnet` | `testnet`
- `account` (optional): Stellar `G` address (regex: `^G[A-Z2-7]{55}$`). Absent = period overview; present = ego drill with this account's direct counterparties.

**Success response (200):**
```json
{
  "period": "1d",
  "nodes": [
    { "account": "G...", "label": "Kraken" }
  ],
  "edges": [
    {
      "source": "G...",
      "destination": "G...",
      "asset": { "type": "native" },
      "amount": "12345.6789",
      "amountComplete": true,
      "operationCount": 15
    }
  ],
  "account": "G...",
  "sampled": false
}
```

**Error responses:**
- `400`: Invalid period, network, or account format
- `500`: Provider error (catch + suppress details, follow activity-handler error contract)

**Caching:** `Cache-Control: public, max-age=60, s-maxage=60` (60s, like activity current-period cache)

**Provider errors:** Never leak BigQuery SQL, parameter values, or raw account addresses. Return only the documented public JSON error codes.

### Client rendering constraints

**Canvas vs SVG:** Use SVG for the initial v1 implementation:
- DOM event model enables keyboard navigation and screen-reader integration
- Simpler accessibility compliance (ARIA labels, focus management)
- No GPU memory pressure for large graphs

**Accessibility requirements:**
- Each node and edge is a focusable DOM element with descriptive `aria-label`
- Source and destination account labels or addresses in edge labels
- Keyboard shortcuts: arrow keys to traverse edges, Enter/Space to drill into a node, Escape to return to period overview
- High-contrast color palette for edges and nodes (follows dashboard color scheme)

**Reduced motion support:**
- Respect `prefers-reduced-motion: reduce` CSS media query
- Static layout instead of force-directed simulation on reduced-motion clients
- No auto-pan/zoom animations

**Optional for v1:**
- Force-directed layout (allowed but not required for acceptance)
- Mobile touch interactions (accept minimal for now, polish in v2)
- Live/streaming updates (explicitly deferred to post-v1)

### Fixture-first contributor path

**Fixture data location:** `lib/fixtures/flow.ts`

**Fixture design:**
- Include 3–5 known account pairs (e.g., Kraken → Lobstr, Soroswap → user wallet)
- Create 2–3 operations per edge for deterministic counts
- Use real Stellar addresses (from `data/entities.json`) or well-known public addresses
- Cover all operation types (payment, create_account, account_merge) in one fixture

**Contributor workflow:**
1. Read this ADR and the [payment-flow edge methodology](../metric-methodology.md#payment-flow-graph)
2. Enable fixture mode: `LUMENMAP_DATA_SOURCE=fixture`
3. Open `http://localhost:3000?view=flow&flow=1` (or navigate via UI toggle when enabled)
4. Verify period overview renders, then click a node to drill into its ego network
5. Assert fixture data matches hardcoded expected edges
6. Submit PR with UI changes; BigQuery queries land in a follow-up Wave

**Test fixture via:**
```bash
npm test -- flow.test.ts
```

### Dependency order for follow-up waves

1. **Wave 1 (this ADR, completed):** Architecture and fixtures
2. **Wave 2:** BigQuery queries for all operation types (after Wave 1 accepted)
3. **Wave 3:** React/D3 components with SVG rendering and keyboard navigation
4. **Wave 4:** Accessibility audit and WCAG compliance (external review)
5. **Wave 5 (post-launch):** Force-directed layout and mobile polish

### Non-goals

- No real-time mempool monitoring or WebSocket subscriptions
- No cross-asset USD pricing or normalization in v1
- No full-chain transaction crawl (top 100 edges is intentional cap)
- No settlement or finality attestation

## Consequences

**Positive:**
- Clear API contract before implementation; easier review and testing
- Fixture strategy unblocks contributor onboarding without GCP credentials
- Deterministic top-N sampling prevents ambiguous "why is this edge missing?" confusion
- SVG accessibility foundation carries into later force-directed layouts

**Negative:**
- Top-100 cap means rare edges are silently excluded; must document in UI
- No real-time freshness; users expect 60s cache lag (same as activity)
- Asset-mode filtering requires separate ranking pass; slight BigQuery cost increase
- Screen-reader users may find large graphs overwhelming; mitigation via drill-down

**Risk:**
- If BigQuery query latency exceeds 5s on large periods, edge-ranking becomes a bottleneck; mitigation: materialized views or pre-aggregation
- Fixture data must stay in sync with methodology; add a CI check to validate fixture operation types against schema

## Links

- **Metric methodology:** [Payment-flow graph](../metric-methodology.md#payment-flow-graph)
- **In-app guide:** [Flow methodology anchor](../../app/methodology/page.tsx) (exported from `lib/metrics/flow-methodology-anchors.ts`)
- **Example API implementation:** `/app/api/v1/flow/route.ts`
- **Fixture data:** `/lib/fixtures/flow.ts` (to be created)
- **UI components:** `/components/flow/` (to be created)
