"use client";

import { bucketRetentionCohorts, retentionRate, MAX_COHORT_WEEKS, COHORT_SAMPLE_CAP } from "@/lib/cohorts/retention";
import { retentionCohortFixture } from "@/lib/fixtures/retention-cohorts";

function heat(rate: number | null): string {
  if (rate === null) return "bg-zinc-900 text-zinc-500";
  if (rate >= 0.66) return "bg-emerald-700/80 text-white";
  if (rate >= 0.33) return "bg-amber-700/70 text-white";
  return "bg-zinc-800 text-zinc-200";
}

/**
 * Weekly retention heatmap. Fixture-backed so demos work without GCP.
 * Sampling cap is documented beside the chart.
 */
export function RetentionCohortChart() {
  const buckets = bucketRetentionCohorts(retentionCohortFixture, MAX_COHORT_WEEKS);
  const offsets = Math.max(...buckets.map((bucket) => bucket.retained.length), 1);

  return (
    <section aria-labelledby="retention-heading" className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="retention-heading" className="text-sm font-semibold text-white">
          Returning wallet cohorts
        </h2>
        <p className="text-xs text-zinc-500">Weekly only · last {MAX_COHORT_WEEKS} weeks · fixture</p>
      </div>
      <p className="mt-2 max-w-3xl text-xs text-zinc-400">
        Each row is wallets active in week W0. Cells show how many of those wallets return in later weeks.
        Distinct counts are capped at {COHORT_SAMPLE_CAP.toLocaleString()} wallets per cohort so the query stays
        inside the bytes-billed budget. This view does not attempt identity resolution.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-xs sm:min-w-0 sm:text-sm">
          <caption className="sr-only">Weekly wallet retention by cohort</caption>
          <thead>
            <tr className="text-zinc-500">
              <th scope="col" className="py-2 pr-3 font-medium">Cohort</th>
              <th scope="col" className="py-2 pr-3 font-medium">Size</th>
              {Array.from({ length: offsets }, (_, offset) => (
                <th key={offset} scope="col" className="px-1 py-2 font-medium">
                  W+{offset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.weekIndex}>
                <th scope="row" className="py-1 pr-3 font-medium text-zinc-200">
                  Week {bucket.weekIndex}
                  {bucket.sampled ? " (sampled)" : ""}
                </th>
                <td className="py-1 pr-3 text-zinc-400">{bucket.size}</td>
                {Array.from({ length: offsets }, (_, offset) => {
                  const rate = retentionRate(bucket, offset);
                  return (
                    <td key={offset} className="px-1 py-1">
                      <span className={`inline-flex min-w-12 justify-center rounded px-2 py-1 ${heat(rate)}`}>
                        {rate === null ? "—" : `${Math.round(rate * 100)}%`}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
