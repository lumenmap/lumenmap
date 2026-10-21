import type { WalletWeekActivity } from "@/lib/cohorts/retention";

/**
 * Offline cohort fixture. No BigQuery. Wallets a/b return; c drops after week 0;
 * d appears only in week 2.
 */
export const retentionCohortFixture: WalletWeekActivity[] = [
  { walletId: "wallet-a", weekIndex: 0 },
  { walletId: "wallet-a", weekIndex: 1 },
  { walletId: "wallet-a", weekIndex: 2 },
  { walletId: "wallet-b", weekIndex: 0 },
  { walletId: "wallet-b", weekIndex: 2 },
  { walletId: "wallet-c", weekIndex: 0 },
  { walletId: "wallet-d", weekIndex: 2 },
  { walletId: "wallet-a", weekIndex: 3 },
  { walletId: "wallet-e", weekIndex: 1 },
  { walletId: "wallet-e", weekIndex: 3 },
];
