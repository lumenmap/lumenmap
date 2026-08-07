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

## Component mappings

- `Button`: uses `bg-surface-accent`, `text-foreground`, `hover:bg-surface-accent-hover`, and focus ring `ring-focus`.
- `Card`: uses `bg-surface`, `border-border`, and text defaults for titles and body copy.
- `Badge`: uses accent-muted or surface-muted backgrounds depending on variant.
- `Page canvas`: uses `bg-canvas` and `text-foreground`.

## Notes

- Do not reuse interface accent colors for data category visualization.
- Use data category tokens only for treemap or legend color assignments.
- Keep spacing roles aligned to `--space-4` / `--space-5` for most desktop card layouts.
