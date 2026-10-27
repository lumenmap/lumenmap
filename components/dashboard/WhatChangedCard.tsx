"use client";

import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { generateWhatChangedNarrative } from "@/lib/narrative";
import { PERIOD_OPTIONS } from "@/lib/periods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";

export function WhatChangedCard() {
  const { data, comparisonData, period, comparePeriod } = useDashboard();

  if (!comparePeriod || !comparisonData || !data) {
    return null;
  }

  const periodLabel =
    PERIOD_OPTIONS.find((item) => item.value === period)?.label ?? period;
  const comparePeriodLabel =
    PERIOD_OPTIONS.find((item) => item.value === comparePeriod)?.label ??
    comparePeriod;

  const narrative = generateWhatChangedNarrative({
    current: data,
    baseline: comparisonData,
    periodLabel,
    comparePeriodLabel,
  });

  if (!narrative || narrative.bullets.length === 0) {
    return null;
  }

  return (
    <Card
      data-testid="what-changed-card"
      className="border border-stellar-light/20 bg-gradient-to-r from-zinc-900/90 via-zinc-900/70 to-zinc-900/90 shadow-md backdrop-blur-sm"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-stellar-light" aria-hidden="true" />
          <CardTitle className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
            What Changed
          </CardTitle>
          <span className="text-xs text-zinc-400">
            ({narrative.periodLabel} vs {narrative.comparePeriodLabel})
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2.5 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
          {narrative.bullets.map((bullet) => (
            <li
              key={bullet.id}
              className="flex items-start justify-between gap-2 rounded-md border border-white/5 bg-white/[0.02] p-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-stellar-light" />
                <span className="leading-relaxed">{bullet.text}</span>
              </div>
              {bullet.chartHref ? (
                <a
                  href={bullet.chartHref}
                  aria-label={`View chart for ${bullet.id}`}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-xs text-stellar-light hover:text-white"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
