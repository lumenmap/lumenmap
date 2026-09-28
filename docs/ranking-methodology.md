# Actor Ranking Methodology

## Receiver-Aware Semantics

### Core Principles
1. **Dual Attribution**: Payment-like operations (`Transfer`, `Payment`) attribute activity to both source and destination accounts
2. **Volume Weighting**: Receiver rankings use `op_destination_amount` (post-P0) for volume calculation
3. **Combined View**: Default ranking shows source activity; receiver toggle shows destination activity

### Ranking Formulas
```typescript
// Source ranking (existing)
const sourceScore = sum(op_source_amount) * activityMultiplier

// Receiver ranking (new)
const receiverScore = sum(op_destination_amount) * activityMultiplier

// Combined ranking
const combinedScore = sourceScore + receiverScore
```

### Edge Cases
- **Self-Transfers**: Activity split 50/50 between source/destination
- **Zero-Volume**: Receivers with no activity excluded from top-N
- **Multi-Hop**: Only direct destination accounts counted
```