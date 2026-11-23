# Horizon fallback

Hubble on BigQuery is the primary source. `LUMENMAP_HORIZON_FALLBACK` defaults off. Set it to `1` to allow a degraded read path when the BigQuery health check is not `ok`.

The degraded path shows one tile, labeled `Degraded · Horizon fallback`. Its operation count is the sum of `operation_count` on a Horizon ledgers payload. That payload is supplied as `LUMENMAP_HORIZON_MOCK` until a live Horizon client is validated. The route does not call Horizon itself.

The banner stays on screen for the whole degraded session. Hubble KPI tiles are left unchanged and are not filled with the Horizon estimate. The Horizon estimate is not written into those tiles.

`GET /api/health` reports `fallback.active`, `fallback.source` (`horizon` or `none`), and `fallback.operationCount`.
