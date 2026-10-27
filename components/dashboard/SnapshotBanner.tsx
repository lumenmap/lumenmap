"use client";

import Link from "next/link";

export function SnapshotBanner({
  generatedAt,
  detail,
}: {
  generatedAt: string;
  detail?: string;
}) {
  return (
    <div
      role="status"
      data-testid="snapshot-banner"
      className="rounded-lg border border-sky-800/70 bg-sky-950/40 px-3 py-3 text-sm text-sky-100 sm:px-4"
    >
      <p>Frozen research view · generatedAt {generatedAt}</p>
      {detail ? (
        <p className="mt-1 text-xs text-sky-200/90">{detail}</p>
      ) : null}
    </div>
  );
}

export function SnapshotMissing() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-white sm:text-2xl">
        Snapshot unavailable
      </h1>
      <p className="text-sm text-zinc-400">
        This research snapshot is missing or has expired. Snapshots are kept
        for 7 days and then return this empty state.
      </p>
      <Link
        href="/"
        className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-900"
      >
        Back to the live dashboard
      </Link>
    </div>
  );
}
