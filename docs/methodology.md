# LumenMap metric methodology (v2.1.0)

Canonical counting rules for LumenMap metrics. These definitions describe how the product measures activity. They are **not** marketing claims about network health or protocol performance.

The interactive copy lives at [`/methodology`](/methodology). Section anchors:

| Section | Anchor |
| --- | --- |
| Operations | `#operations` |
| Operation categories | `#operation-categories` |
| Transactions | `#transactions` |
| Payment volume | `#payment-volume` |
| TVL | `#tvl` |
| Active accounts | `#active-accounts` |
| Active destination accounts | `#active-destination-accounts` |
| Active contracts | `#active-contracts` |
| Soroban share | `#soroban-share` |
| Soroban fees and resources | `#soroban-fees` |
| Top category | `#top-category` |
| Time basis | `#time-basis` |
| Hubble freshness | `#hubble-freshness` |
| Payment-flow graph | `#flow` |
| Flow · nodes | `#flow-nodes` |
| Flow · edges | `#flow-edges` |
| Flow · sampling and coverage | `#flow-sampling` |
| Flow · asset modes | `#flow-asset-modes` |

Source of truth for metric section bodies: [`lib/metrics/methodology.ts`](../lib/metrics/methodology.ts).

Payment-flow graph anchors are exported from [`lib/metrics/flow-methodology-anchors.ts`](../lib/metrics/flow-methodology-anchors.ts) so the Flow legend and coverage badge link to stable ids. The canonical edge rules are in [`metric-methodology.md`](./metric-methodology.md#payment-flow-graph).

## SAC and Classic Asset Volume Leaderboard (`#asset-volume-leaderboard`)

The Asset Volume Leaderboard ranks classic Stellar assets and Stellar Asset Contracts (SAC) by native token volume and operation count share for the selected period. Because no external USD price oracle is used, volumes represent native asset units bounded to safe IEEE-754 integers (`<= 1e15`); rows outside safe parsing bounds are excluded rather than failing the request.
