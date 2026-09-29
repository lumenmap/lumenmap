# Visual Token Usage Guide

This project uses semantic interface tokens to separate UI design intent from component implementation.

## Semantic token roles

- `--color-background`: Page-level base canvas.
- `--color-canvas`: Content canvas behind cards and panels.
- `--color-surface`: Primary surface background for cards and panels.
- `--color-surface-muted`: Subtle surface background for secondary containers.
- `--color-surface-soft`: Soft surfaces for borders and hover states.
- `--color-surface-accent`: Accent surface for primary actions.
- `--color-surface-accent-hover`: Hover state for action surfaces.
- `--color-surface-accent-muted`: Tinted accent backgrounds for badges and tags.
- `--color-surface-accent-strong`: Accent fill for controls that carry text (selected toggles, primary buttons). The accessible pair for `--color-foreground`.
- `--color-surface-accent-strong-hover`: Hover state for those filled controls.
- `--color-border`: Standard border tone.
- `--color-border-muted`: Muted borders and dividers.
- `--color-foreground`: Primary text and icon color.
- `--color-text-primary`: Headline and body text on dark surfaces.
- `--color-text-secondary`: Secondary labels and metadata.
- `--color-text-muted`: Disabled or low-priority text.
- `--color-text-link`: Links and interactive text.
- `--color-focus`: Focus ring and keyboard navigation highlights.

## Status roles

- `--color-status-success`: Success and positive state.
- `--color-status-warning`: Warning and caution state.
- `--color-status-danger`: Error and destructive state.
- `--color-status-info`: Informational accents.

## Data categories

Data category colors are intentionally separate from interface accents.

- `--color-soroban`: Soroban contract activity.
- `--color-payments`: Payments activity.
- `--color-dex`: DEX and market activity.
- `--color-trustlines`: Trustline activity.
- `--color-account`: Account operation activity.
- `--color-other`: Miscellaneous activity.

## Typography roles

- `--font-size-xs`: 12px
- `--font-size-sm`: 14px
- `--font-size-base`: 16px
- `--font-size-lg`: 18px
- `--font-size-xl`: 20px
- `--font-size-2xl`: 24px
- `--line-height-base`: 1.5

## Spacing roles

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-7`: 28px
- `--space-8`: 32px

## How to use tokens

Prefer semantic Tailwind classes or custom variables instead of raw color utilities.

Examples:

- `bg-canvas` for page or section canvas.
- `bg-surface` for main cards and panels.
- `border-border` for standard borders.
- `text-text-primary` for primary copy.
- `text-text-secondary` for labels and metadata.
- `text-text-muted` for hint text.
- `bg-surface-accent` for primary actions and interactive surfaces.
- `text-surface-accent` for accent text.

## Contrast guidance

Text roles are chosen for dark surfaces and follow accessible contrast principles:

- `text-text-primary` on `surface` or `canvas` gives strong legibility.
- `text-text-secondary` on `surface` supports metadata contrast.
- `text-text-muted` is reserved for low-priority labels.
- Status colors are distinct, maintain a strong color relationship, and should be used with corresponding supporting backgrounds.

### Measured ratios for control states

WCAG 2.1 AA needs **4.5:1** for control labels under 18.66px bold / 24px, and
**3:1** for focus indicators against adjacent colors. Measured against
`--background` (#0b0e14), `--canvas` (#10131a) and `--surface-accent-strong`
(#5f4ae0):

| State | Foreground | Background | Ratio | AA |
| --- | --- | --- | --- | --- |
| Selected control (previous) | `--foreground` #f4f4f5 | `--surface-accent` #7b61ff | 3.82:1 | ✗ |
| Selected control, hover (previous) | `--foreground` #f4f4f5 | `--surface-accent-hover` #927cff | 2.92:1 | ✗ |
| **Selected control (current)** | `--foreground` #f4f4f5 | `--surface-accent-strong` #5f4ae0 | **5.39:1** | ✓ |
| **Selected control, hover (current)** | `--foreground` #f4f4f5 | `--surface-accent-strong-hover` #6a52e6 | **4.82:1** | ✓ |
| Unselected control | `--text-secondary` #c6c6d0 | `--background` #0b0e14 | 11.40:1 | ✓ |
| Unselected control, hover | `--text-secondary` #c6c6d0 | `surface-soft` over `--canvas` (#1e2126) | 9.53:1 | ✓ |
| Metric description (previous) | `zinc-500` #71717a | `--canvas` #10131a | 3.84:1 | ✗ |
| **Metric description (current)** | `--text-muted` #8d8e98 | `--canvas` #10131a | **5.71:1** | ✓ |
| Focus ring on page | `--focus` #8e7cff | `--background` #0b0e14 | 5.96:1 | ✓ |
| Focus ring on canvas | `--focus` #8e7cff | `--canvas` #10131a | 5.73:1 | ✓ |
| Focus ring **without** offset | `--focus` #8e7cff | `--surface-accent-strong` #5f4ae0 | 1.83:1 | ✗ |

The last row is why every focusable control sets `focus-visible:ring-offset-2`
with `ring-offset-background`: the ring then sits on the dark page surface
(5.96:1) instead of dissolving into the filled control it surrounds.

Use `--surface-accent` / `--surface-accent-hover` for non-text accent surfaces
(badges, borders, chart accents) and the `-strong` pair whenever text sits on the
accent fill.

## Component mappings

- `Button`: `default` uses `bg-surface-accent-strong`, `text-foreground`, `hover:bg-surface-accent-strong-hover`; `outline` uses `border-border` with `text-text-secondary`; focus ring is `ring-focus` with `ring-offset-2 ring-offset-background`.
- `Card`: uses `bg-surface`, `border-border`, and text defaults for titles and body copy.
- `Badge`: uses accent-muted or surface-muted backgrounds depending on variant.
- `Page canvas`: uses `bg-canvas` and `text-foreground`.

## Notes

- Do not reuse interface accent colors for data category visualization.
- Do not place text on `--surface-accent` or `--surface-accent-hover`; use the `-strong` pair instead (see the measured ratios above).
- Keep spacing roles aligned to `--space-4` / `--space-5` for most desktop card layouts.
