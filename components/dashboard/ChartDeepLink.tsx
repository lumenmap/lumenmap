"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { buildChartDeepLink, chartIdFromHash } from "@/lib/chart-deep-link";

export function ChartDeepLinkRestorer() {
  useEffect(() => {
    const restore = () => {
      const chartId = chartIdFromHash(window.location.hash);
      if (!chartId) return;
      const target = document.getElementById(chartId);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    };
    const frame = window.requestAnimationFrame(restore);
    window.addEventListener("hashchange", restore);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", restore);
    };
  }, []);

  return null;
}

export function ChartDeepLink({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  const copyLink = async () => {
    const result = await copyText(buildChartDeepLink(window.location.href, id));
    setStatus(result.ok ? "copied" : "failed");
    window.setTimeout(() => setStatus("idle"), 2_000);
  };

  return (
    <section id={id} tabIndex={-1} className="scroll-mt-6 outline-none">
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs text-zinc-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar"
          aria-label={`Copy deep link to ${label}`}
        >
          {status === "copied" ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
          {status === "copied" ? "Link copied" : "Copy link"}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {status === "copied" ? `${label} link copied` : status === "failed" ? "Could not copy link" : ""}
        </span>
      </div>
      {children}
    </section>
  );
}

