"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildClaimableVelocity,
  isClaimableVelocityEmpty,
  type ClaimableVelocity,
} from "@/lib/metrics/claimable-velocity";
import {
  CLAIMABLE_VELOCITY_FIXTURE,
  CLAIMABLE_VELOCITY_RANGE,
} from "@/lib/metrics/claimable-velocity-fixture";
import {
  CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS,
  claimableVelocityMethodologyHref,
} from "@/lib/metrics/claimable-velocity-methodology-anchors";

export function ClaimableVelocityView({ result }: { result: ClaimableVelocity }) {
  if (result.status === "unavailable") {
    return <p role="status">{result.reason}</p>;
  }
  if (isClaimableVelocityEmpty(result)) {
    return (
      <p role="status">
        No claimable-balance create or claim activity in this period.
      </p>
    );
  }
  const peak = Math.max(
    1,
    ...result.buckets.flatMap((bucket) => [bucket.create, bucket.claim]),
  );
  return (
    <div className="flex flex-col gap-4">
      <p>
        Net outstanding delta: {result.net > 0 ? "+" : ""}
        {result.net}
      </p>
      <p className="text-xs text-zinc-400">
        create_claimable_balance counts as a create. claim_claimable_balance
        counts as a claim. Buckets are UTC days. Clawbacks and other operation
        types are not included. Net outstanding is creates minus claims for the
        selected window, not a reconstructed ledger.
      </p>
      <p className="text-xs text-zinc-500">
        <a
          href={claimableVelocityMethodologyHref(
            CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS.classification,
          )}
          className="text-stellar-light hover:text-white"
        >
          Classification
        </a>
        {" · "}
        <a
          href={claimableVelocityMethodologyHref(
            CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS.netDelta,
          )}
          className="text-stellar-light hover:text-white"
        >
          Net outstanding delta
        </a>
        {" · "}
        <a
          href={claimableVelocityMethodologyHref(
            CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS.limits,
          )}
          className="text-stellar-light hover:text-white"
        >
          Limits
        </a>
      </p>
      <ul className="flex flex-col gap-3">
        {result.buckets.map((bucket) => (
          <li
            key={bucket.bucket}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="w-28 shrink-0 font-mono text-xs text-zinc-300">
              {bucket.bucket}
            </span>
            <span className="sr-only">
              {bucket.create} created, {bucket.claim} claimed
            </span>
            <span
              className="flex h-3 min-w-0 flex-1 overflow-hidden rounded bg-zinc-900"
              aria-hidden="true"
            >
              <span
                className="bg-cyan-400"
                style={{ width: `${(bucket.create / peak) * 100}%` }}
              />
              <span
                className="bg-rose-400"
                style={{ width: `${(bucket.claim / peak) * 100}%` }}
              />
            </span>
            <span
              className="font-mono text-xs text-zinc-400"
              aria-hidden="true"
            >
              +{bucket.create} / −{bucket.claim}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Fixture-backed create vs claim velocity. Live activity responses do not yet
 * ship typed claimable subtypes for this chart, so the default path prefers the
 * documented fixture dataset. Passing `rows` uses those rows instead.
 */
export function ClaimableVelocityChart({ rows }: { rows?: unknown } = {}) {
  const useFixture = rows === undefined;
  const result = buildClaimableVelocity(
    useFixture ? CLAIMABLE_VELOCITY_FIXTURE : rows,
    useFixture
      ? CLAIMABLE_VELOCITY_RANGE
      : {
          start: "1970-01-01T00:00:00.000Z",
          end: "2100-01-01T00:00:00.000Z",
        },
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claimable create vs claim</CardTitle>
        <p className="text-xs text-zinc-400">
          Dual series of create and claim operations by UTC day.
          {useFixture ? " Fixture sample." : ""}{" "}
          <a
            href={claimableVelocityMethodologyHref(
              CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS.velocity,
            )}
            className="text-stellar-light hover:text-white"
          >
            Methodology
          </a>
        </p>
      </CardHeader>
      <CardContent data-testid="claimable-velocity-chart">
        <ClaimableVelocityView result={result} />
      </CardContent>
    </Card>
  );
}
