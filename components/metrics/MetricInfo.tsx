"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import type { MetricDefinition } from "@/lib/metrics/definitions";
import { cn } from "@/lib/utils";

interface MetricInfoProps {
  metric: MetricDefinition;
  className?: string;
}

export function MetricInfo({ metric, className }: MetricInfoProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-zinc-400 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`About ${metric.title}`}
        onClick={() => setOpen((value) => !value)}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="absolute right-0 z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-zinc-950/95 p-3 text-left shadow-xl backdrop-blur-sm"
        >
          <p id={titleId} className="text-sm font-medium text-white">
            {metric.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-300">
            {metric.definition}
          </p>
          <dl className="mt-3 space-y-2 text-xs text-zinc-400">
            <div>
              <dt className="text-zinc-500">Unit</dt>
              <dd className="text-zinc-200">{metric.unit}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Primary limitation</dt>
              <dd className="text-zinc-200">{metric.limitation}</dd>
            </div>
          </dl>
          <a
            href={metric.methodologyHref}
            className="mt-3 inline-flex text-xs font-medium text-stellar-light underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm"
          >
            Methodology: {metric.methodologySection.replaceAll("-", " ")}
          </a>
        </div>
      ) : null}
    </div>
  );
}
