# Treemap period-over-period diff

The Network Treemap can color every tile by how much it **grew or shrank
relative to the previous equal-length window** (issue #447). Toggle it with
the *Diff vs previous* button in the treemap card, or share a link with the
URL flag:

```
/?period=7d&diff=1
```

`diff=1` (or `diff=true`) turns the overlay on; removing the parameter turns
it off. The flag combines with every other URL state parameter (`period`,
`metric`, `view`, `path`, …).

## The previous equal-length window

The diff always compares the active window against the window of the same
length immediately before it (`resolvePreviousPeriodRange` in
`lib/periods.ts`):

| Active period | Previous window                     |
| ------------- | ----------------------------------- |
| `1d` (today)  | Yesterday                           |
| `7d`          | The 7 days before the current 7     |
| `30d`         | The 30 days before the current 30   |
| `month`       | The previous calendar month         |

The API serves the previous window through
`GET /api/v1/activity?period=<period>&window=prev`. Diffing arbitrary
non-adjacent custom ranges is out of scope for v1.

## Diverging color scale

Tile fill (and the table's delta coloring) uses a diverging red–gray–green
scale over the **percent change** of each tile's value against the same node
in the previous window:

| Condition                    | Bucket           | Color   |
| ---------------------------- | ---------------- | ------- |
| Present only now ("new")     | `new`            | `#a78bfa` (violet) |
| Change ≥ **+50%**            | `strong-growth`  | `#16a34a` |
| +10% to +50%                 | `growth`         | `#4ade80` |
| Within **±10%**              | `flat`           | `#52525b` |
| −10% to −50%                 | `decline`        | `#f87171` |
| Change ≤ **−50%**            | `strong-decline` | `#b91c1c` |

Notes:

- **Color saturates at ±50%** (`TREEMAP_DIFF_CLAMP_PERCENT`). A single
  runaway tile must not wash out every other tile on the scale; tooltips and
  the table always show the *unclamped* absolute and percent values.
- **Color is never the only encoding.** Tiles and table rows carry a signed
  value (`+2.0K (+20.0%)`), a direction icon (▲/▼), and screen-reader labels
  that spell the change out in words.
- The category **pattern overlay is kept** in diff mode, so category identity
  remains a non-color cue even while the fill encodes change.

## "New" and "dropped" tiles

A node is matched between windows by its stable id (`meta.id`, then node
`id`, then name), per sibling set, at every drill level.

- **New** — the node has activity now but had none in the previous window.
  Percent change is undefined (shown as "new", not `+∞`). The tile is violet,
  labeled `· NEW` when it has room, and the table row gets a `New` badge.
- **Dropped** — the node had activity in the previous window but has none
  now. A zero-value tile cannot occupy space in a treemap, so dropped nodes
  **have no tile**; they are appended to the data table for the current drill
  level with a `Dropped` badge, their previous value, and a `−100%` delta.
  The legend states this explicitly.

## Metric applicability

The overlay works for operation count, transaction count, XLM volume, and
USDC volume treemaps. It is **disabled for protocol TVL**: adapters report a
current snapshot, so a previous-window fetch would return today's values and
every tile would read as flat.

## Fixture support

In fixture mode (`LUMENMAP_DATA_SOURCE=fixture`), the previous window is
served by `getFixturePreviousRawActivity` (`lib/fixtures/raw-data.ts`), which
scales the deterministic base rows so every diverging bucket is reproducible:

- `payment` categories **grew +25%**, `change_trust` **grew +66.7%**,
- `invoke_host_function` **declined −20%**, `set_options` **declined −28.6%**,
- `soroswapRouter` exists only in the current window (**new** tile),
- `FIXTURE_CONTRACTS.dropped` exists only in the previous window
  (**dropped** table row),
- everything else is **flat**.

The Playwright spec `e2e/treemap-diff.spec.ts` asserts against these values.
