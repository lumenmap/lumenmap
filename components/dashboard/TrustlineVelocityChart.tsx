"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildTrustlineVelocity,
  type TrustlineVelocity,
} from "@/lib/metrics/trustline-velocity";

export function TrustlineVelocityView({ result }: { result: TrustlineVelocity }) {
  if (result.status === "unavailable") {
    return <p role="status">{result.reason}</p>;
  }
  const peak = Math.max(1, ...result.buckets.flatMap((bucket) => [bucket.create, bucket.remove]));
  return (
    <div className="flex flex-col gap-4">
      <p>
        Net trustline change: {result.net > 0 ? "+" : ""}
        {result.net}
      </p>
      <p className="text-xs text-zinc-400">
        A change_trust with a positive limit counts as a create. A limit of zero counts as a remove.
        Buckets are UTC days. Other operation types are not included.
      </p>
      <ul className="flex flex-col gap-3">
        {result.buckets.map((bucket) => (
          <li key={bucket.bucket} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="w-28 shrink-0 font-mono text-xs text-zinc-300">{bucket.bucket}</span>
            <span className="sr-only">
              {bucket.create} created, {bucket.remove} removed
            </span>
            <span className="flex h-3 min-w-0 flex-1 overflow-hidden rounded bg-zinc-900" aria-hidden="true">
              <span className="bg-cyan-400" style={{ width: `${(bucket.create / peak) * 100}%` }} />
              <span className="bg-rose-400" style={{ width: `${(bucket.remove / peak) * 100}%` }} />
            </span>
            <span className="font-mono text-xs text-zinc-400" aria-hidden="true">
              +{bucket.create} / -{bucket.remove}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Live activity responses do not carry trustline limits yet, so this soft-fails. */
export function TrustlineVelocityChart({ rows }: { rows?: unknown }) {
  const result = buildTrustlineVelocity(rows ?? null, {
    start: "1970-01-01T00:00:00.000Z",
    end: "2100-01-01T00:00:00.000Z",
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trustline creation and removal</CardTitle>
      </CardHeader>
      <CardContent>
        <TrustlineVelocityView result={rows === undefined ? {
          status: "unavailable",
          reason: "Trustline operation subtypes are unavailable.",
        } : result} />
      </CardContent>
    </Card>
  );
}
