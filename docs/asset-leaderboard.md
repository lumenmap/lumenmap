# Asset volume leaderboard

Assets are ranked by payment volume for the selected period. Native XLM, classic issued assets (a `G` issuer), and SAC assets (a `C` contract id) stay in one table. Two assets that share a code and not an issuer are different rows.

Columns are code, issuer or SAC, volume, operation count, and share of the parsed volume. Share is within this table only. Amounts are native units. They are not converted to USD or to XLM.

A row is omitted when its amount or operation count cannot be parsed. The table says how many rows were omitted. If every row is omitted, the panel says the volume is unavailable instead of showing an empty ranking. Issuers are shown as a truncated address with copy, and linked to Stellar Expert. There is no price oracle and no holder count.
