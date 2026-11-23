# Trustline creation and removal

`change_trust` is a create when its limit is above zero and a removal when its limit is zero. Payment and other operation types are ignored. A `change_trust` row with no limit makes the whole series unavailable: create and remove cannot be inferred from the operation name alone.

Buckets are UTC dates of `closedAt`. Rows outside the selected period are excluded. The net change is creates minus removes across the buckets that remain. The chart repeats those counts in text so the bars are not the only way to read them.
