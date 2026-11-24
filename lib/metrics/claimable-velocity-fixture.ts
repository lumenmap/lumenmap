/** Creates and claims across two UTC days, plus noise outside the period. */
export const CLAIMABLE_VELOCITY_FIXTURE = [
  {
    closedAt: "2026-11-20T02:00:00.000Z",
    type: "create_claimable_balance",
    count: 6,
  },
  {
    closedAt: "2026-11-20T16:00:00.000Z",
    type: "claim_claimable_balance",
    count: 3,
  },
  {
    closedAt: "2026-11-21T04:00:00.000Z",
    type: "create_claimable_balance",
    count: 2,
  },
  {
    closedAt: "2026-11-21T11:00:00.000Z",
    type: "claim_claimable_balance",
    count: 4,
  },
  {
    closedAt: "2026-11-21T12:00:00.000Z",
    type: "clawback_claimable_balance",
    count: 7,
  },
  {
    closedAt: "2026-11-21T13:00:00.000Z",
    type: "payment",
    count: 9,
  },
  {
    closedAt: "2026-11-01T00:00:00.000Z",
    type: "create_claimable_balance",
    count: 100,
  },
];

export const CLAIMABLE_VELOCITY_RANGE = {
  start: "2026-11-20T00:00:00.000Z",
  end: "2026-11-22T00:00:00.000Z",
};

/** Empty-period fixture: valid shape, zero claimable create/claim activity. */
export const CLAIMABLE_VELOCITY_EMPTY_FIXTURE = [
  {
    closedAt: "2026-11-20T08:00:00.000Z",
    type: "payment",
    count: 3,
  },
];
