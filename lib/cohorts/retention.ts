/**
 * Weekly returning-wallet cohorts.
 *
 * A wallet is in cohort W0 when it is active in that week. Retention at offset
 * n is the share of that cohort also active in week W0+n. Weekly only.
 */

export const MAX_COHORT_WEEKS = 8;
export const COHORT_SAMPLE_CAP = 5_000;

export type WalletWeekActivity = {
  walletId: string;
  /** Zero-based week index inside the bounded window. */
  weekIndex: number;
};

export type CohortBucket = {
  weekIndex: number;
  size: number;
  /** retained[offset] is wallets from this cohort active `offset` weeks later. */
  retained: number[];
  /** True when the sample cap dropped additional wallets from this cohort. */
  sampled: boolean;
};

export function normalizeWalletId(walletId: string): string {
  return walletId.trim();
}

/**
 * Bucket wallet-week observations into weekly retention cohorts.
 * Weeks outside 0..weekCount-1 are ignored. Duplicate wallet/week pairs count once.
 */
export function bucketRetentionCohorts(
  events: WalletWeekActivity[],
  weekCount = MAX_COHORT_WEEKS,
  sampleCap = COHORT_SAMPLE_CAP,
): CohortBucket[] {
  const weeks = Math.min(Math.max(weekCount, 1), MAX_COHORT_WEEKS);
  const byWeek = new Map<number, Set<string>>();

  for (let week = 0; week < weeks; week += 1) {
    byWeek.set(week, new Set());
  }

  for (const event of events) {
    if (!Number.isInteger(event.weekIndex) || event.weekIndex < 0 || event.weekIndex >= weeks) {
      continue;
    }
    const walletId = normalizeWalletId(event.walletId);
    if (!walletId) continue;
    byWeek.get(event.weekIndex)?.add(walletId);
  }

  return Array.from({ length: weeks }, (_, weekIndex) => {
    const members = [...(byWeek.get(weekIndex) ?? [])].sort();
    const sampled = members.length > sampleCap;
    const cohort = new Set(sampled ? members.slice(0, sampleCap) : members);
    const retained = Array.from({ length: weeks - weekIndex }, (_, offset) => {
      const later = byWeek.get(weekIndex + offset) ?? new Set<string>();
      let count = 0;
      for (const walletId of cohort) {
        if (later.has(walletId)) count += 1;
      }
      return count;
    });

    return { weekIndex, size: cohort.size, retained, sampled };
  });
}

export function retentionRate(bucket: CohortBucket, offset: number): number | null {
  if (bucket.size === 0) return null;
  const retained = bucket.retained[offset];
  if (retained === undefined) return null;
  return retained / bucket.size;
}
