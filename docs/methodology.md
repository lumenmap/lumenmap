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

## Soroban Contract Invoke Success vs Failure Rate (`#soroban-invoke-outcomes`)

When a Soroban contract entity is selected in `DetailPanel`, LumenMap computes the selected period's invoke outcome split (`successful_count` vs `failed_count`). To remain accessible without relying on color alone, the rate is presented as explicit text (`"<rate>% succeeded (<succeeded> succeeded ? <failed> failed of <total> invokes)"`). If upstream Hubble columns are missing or null due to schema drift, the panel soft-fails to `"Unavailable"`.
