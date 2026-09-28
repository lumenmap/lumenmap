# Dashboard Filter Applicability

## Overview
All views share the following filters:
- **Period**: Applies to Flow, Treemap, and Chart views.
- **Search Query**: Applies globally.

## View-Specific Notes
- **Flow**: Uses `period` and `searchQuery` (metric may be irrelevant).
- **Treemap**: May ignore `metric` if not applicable to the visualization.
- **Charts**: Uses `metric`, `period`, and `searchQuery`.

## Implementation
Filters are managed via `DashboardProvider`. Components consume state via `useDashboardFilters()` hook.
