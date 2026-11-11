"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IncidentBanner } from "@/components/IncidentBanner";
import {
  classifyIncident,
  fetchReadiness,
  type IncidentState,
} from "@/lib/incident-health";

export const INCIDENT_DEBOUNCE_MS = 2_500;
const HEALTH_POLL_MS = 30_000;

export function IncidentBannerHost({
  debounceMs = INCIDENT_DEBOUNCE_MS,
}: {
  debounceMs?: number;
}) {
  const query = useQuery({
    queryKey: ["readiness-health"],
    queryFn: fetchReadiness,
    refetchInterval: HEALTH_POLL_MS,
    staleTime: 10_000,
    retry: false,
  });
  const candidate = useMemo(
    () => classifyIncident(query.data, query.isError),
    [query.data, query.isError],
  );
  const [visible, setVisible] = useState<IncidentState | null>(null);

  useEffect(() => {
    if (!candidate) return;

    const timer = window.setTimeout(() => setVisible(candidate), debounceMs);
    return () => window.clearTimeout(timer);
  }, [candidate, debounceMs]);

  return candidate && visible?.kind === candidate.kind ? (
    <IncidentBanner key={visible.kind} incident={visible} />
  ) : null;
}
