import { mapInvokeSuccess, type InvokeSuccess } from "@/lib/entities/invoke-success";

export function InvokeSuccessRate({ result }: { result: InvokeSuccess }) {
  if (result.status === "unavailable") {
    return <p role="status">{result.reason}</p>;
  }
  const total = result.success + result.failure;
  const percent = (result.rate * 100).toFixed(1);
  return (
    <section aria-labelledby="invoke-success-heading" className="rounded-lg border border-white/10 bg-black/20 p-3">
      <h3 id="invoke-success-heading" className="mb-2 text-xs font-semibold text-zinc-400">
        Invoke success
      </h3>
      <p>
        {result.success} of {total} invokes succeeded ({percent}%). {result.failure} failed.
      </p>
    </section>
  );
}

export function InvokeSuccessFromMeta(meta: {
  successfulInvokes?: number | null;
  failedInvokes?: number | null;
} | undefined) {
  const result = mapInvokeSuccess(
    meta && ("successfulInvokes" in meta || "failedInvokes" in meta)
      ? { successfulInvokes: meta.successfulInvokes, failedInvokes: meta.failedInvokes }
      : null,
  );
  return <InvokeSuccessRate result={result} />;
}
