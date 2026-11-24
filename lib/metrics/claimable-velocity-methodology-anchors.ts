/**
 * Stable `/methodology` anchor ids for the claimable create/claim velocity chart.
 *
 * The chart KPI and methodology links point at these fragments, so the ids are
 * part of the public URL surface: do not rename them without keeping a
 * redirect-compatible alias.
 */
export const CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS = {
  velocity: "claimable-velocity",
  classification: "claimable-velocity-classification",
  netDelta: "claimable-velocity-net-delta",
  limits: "claimable-velocity-limits",
} as const;

export type ClaimableVelocityMethodologyAnchor =
  (typeof CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS)[keyof typeof CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS];

/** In-app href for a claimable-velocity methodology anchor. */
export function claimableVelocityMethodologyHref(
  anchor: ClaimableVelocityMethodologyAnchor,
): string {
  return `/methodology#${anchor}`;
}
