/** Creates and removals across two UTC days, plus one operation outside the week. */
export const TRUSTLINE_VELOCITY_FIXTURE = [
  { closedAt: "2026-11-20T01:00:00.000Z", type: "change_trust", limit: "100", count: 5 },
  { closedAt: "2026-11-20T18:00:00.000Z", type: "change_trust", limit: "0", count: 2 },
  { closedAt: "2026-11-21T03:00:00.000Z", type: "change_trust", limit: "50", count: 4 },
  { closedAt: "2026-11-21T09:00:00.000Z", type: "payment", limit: "0", count: 9 },
  { closedAt: "2026-11-01T00:00:00.000Z", type: "change_trust", limit: "10", count: 100 },
];

export const TRUSTLINE_VELOCITY_RANGE = {
  start: "2026-11-20T00:00:00.000Z",
  end: "2026-11-22T00:00:00.000Z",
};
