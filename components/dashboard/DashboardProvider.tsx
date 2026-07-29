"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
import type { TreemapViewId } from "@/lib/constants";
import type { ActivityResponse, Period, SelectedNode } from "@/lib/types";

interface DashboardContextValue {
  period: Period;
  setPeriod: (period: Period) => void;
  treemapView: TreemapViewId;
  setTreemapView: (view: TreemapViewId) => void;
  data?: ActivityResponse;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

async function fetchActivity(period: Period): Promise<ActivityResponse> {
  const response = await fetch(`/api/activity?period=${period}`);
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? "Failed to load activity data");
  }
  return response.json() as Promise<ActivityResponse>;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriod] = useState<Period>("1d");
  const [treemapView, setTreemapView] = useState<TreemapViewId>("events");
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  // Clear the selected node whenever the period or view changes so the detail
  // panel does not show stale data. Wrapping the setters avoids the
  // setState-in-effect anti-pattern.
  function handleSetPeriod(p: Period) {
    setSelectedNode(null);
    setPeriod(p);
  }

  function handleSetTreemapView(v: TreemapViewId) {
    setSelectedNode(null);
    setTreemapView(v);
  }

  const query = useQuery({
    queryKey: ["activity", period],
    queryFn: () => fetchActivity(period),
    staleTime: 60_000,
  });

  const value = useMemo(
    () => ({
      period,
      setPeriod: handleSetPeriod,
      treemapView,
      setTreemapView: handleSetTreemapView,
      data: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
      selectedNode,
      setSelectedNode,
    }),
    [
      period,
      treemapView,
      query.data,
      query.isLoading,
      query.isError,
      query.error,
      selectedNode,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}
