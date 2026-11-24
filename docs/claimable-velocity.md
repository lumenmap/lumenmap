# Claimable-balance create vs claim velocity

`create_claimable_balance` counts as a create. `claim_claimable_balance` counts as a claim. Clawbacks and every other operation type are ignored; they are not inferred into either series.

Buckets are UTC dates of `closedAt`. Rows outside the selected period are excluded. When the create/claim series is missing or a counted row is malformed, the chart soft-fails instead of guessing.

Net outstanding delta is creates minus claims across the buckets that remain. That delta is an operation-count approximation for the selected window. It is not a reconstructed claimable-balance ledger, does not include balances created before the period, and does not model sponsors or clawbacks.

Dashboard anchors:

| Topic | Anchor |
| --- | --- |
| Overview | `/methodology#claimable-velocity` |
| Classification | `/methodology#claimable-velocity-classification` |
| Net outstanding delta | `/methodology#claimable-velocity-net-delta` |
| Limits | `/methodology#claimable-velocity-limits` |
