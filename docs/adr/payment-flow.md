# Payment-flow graph decision

**Status:** Proposed

The Flow view represents successful, amount-bearing transfers between Stellar
accounts as directed, asset-specific edges. It aggregates operations before
applying a top-N display cap and reports coverage against the uncapped result.

The canonical field map, operation inclusions and exclusions, asset identity,
and sampling rules are in the [payment-flow edge methodology](../metric-methodology.md#payment-flow-graph)
and the stable [in-app edge anchor](/methodology#flow-edges). Query and UI work
must follow those rules so a graph edge has the same meaning across surfaces.

This decision does not define BigQuery SQL or add a Flow API.
