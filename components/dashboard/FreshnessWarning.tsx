"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { classifyFreshness } from "@/lib/freshness";

/** Format the data-through timestamp for display in the warning banner. */
function formatDataThrough(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

/**
 * Whether the current build/runtime is a local or development context.
 *
 * Only dev/local contexts should surface fixture-mode onboarding help.
 * Production deployments must never see this hint.
 */
function isLocalOrDev(): boolean {
  if (typeof process === "undefined") {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  // Explicit opt-in flag for local/dev deployments that run a production build.
  return process.env.NEXT_PUBLIC_FIXTURE_ONBOARDING === "1";
}

/**
 * FreshnessWarning renders a contextual banner when data lag exceeds the
 * documented stale threshold (lib/freshness.ts).
 *
 * - fresh   → renders nothing
 * - stale   → amber banner with warning icon, exact data-through time
 * - unknown → grey notice
 *
 * Uses `data.sourceTimestamp` from the API response as the data-through time.
 *
 * When data is unavailable (e.g. live API failure) and the build is a local/dev
 * context, an actionable onboarding message points contributors at fixture mode.
 */
export function FreshnessWarning() {
  const { data } = useDashboard();

  if (!data) {
    if (!isLocalOrDev()) {
      return null;
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      >
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
          aria-hidden="true"
        />
        <span className="space-y-2">
          <strong className="font-medium text-amber-300">
            Live activity data is unavailable.
          </strong>
          <span className="block">
            The live API could not be reached. To keep working locally, enable
            fixture mode by setting {" "}
            <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-xs text-amber-100">
              NEXT_PUBLIC_USE_FIXTURES=1
            </code>
            {" "}
            in your <code className="font-mono text-xs">.env.local</code> and restart the
            dev server.
          </span>
          <span className="block">
            See the {" "}
            <a
              href="https://github.com/hubble-project/hubble/blob/main/CONTRIBUTING.md#fixture-mode"
              className="font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200"
              target="_blank"
              rel="noreferrer noopener"
            >
              CONTRIBUTING guide
            </a>
            {" "}
            for the full fixture-mode setup.
          </span>
        </span>
      </div>
    );
  }

  const state = classifyFreshness(data.sourceTimestamp);

  if (state === "fresh") {
    return null;
  }

  if (state === "unknown") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-400"
      >
        <HelpCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
          aria-hidden="true"
        />
        <span>
          <strong className="font-medium text-zinc-300">
            Data freshness unknown.
          </strong>{" "}
          The data-through timestamp is unavailable. Figures may not reflect the
          latest on-chain activity.
        </span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
        aria-hidden="true"
      />
      <span>
        <strong className="font-medium text-amber-300">
          Data may be stale.
        </strong>{" "}
        Hubble has not refreshed within the expected window.{" "}
        <span className="break-words font-mono text-xs text-amber-300/80">
          Data through: {formatDataThrough(data.sourceTimestamp)} UTC
        </span>
      </span>
    </div>
  );
}
