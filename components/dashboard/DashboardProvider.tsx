"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TreemapViewId } from "@/lib/constants";
import type { ActivityResponse, Period, SelectedNode } from "@/lib/types";
import { isValidPeriod } from "@/lib/periods";
import { isValidTreemapView } from "@/lib/constants";

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
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<Period>("1d");
  const [treemapView, setTreemapView] = useState<TreemapViewId>("events");
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  // Initialize state from URL params on mount
  useEffect(() => {
    const urlPeriod = searchParams.get("period");
    const urlView = searchParams.get("view");

    if (urlPeriod && isValidPeriod(urlPeriod)) {
      setPeriod(urlPeriod);
    }
    if (urlView && isValidTreemapView(urlView)) {
      setTreemapView(urlView);
    }
  }, [searchParams]);

  // Update URL when state changes (preserves other query params)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("period", period);
    params.set("view", treemapView);
    const newUrl = `?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [period, treemapView]);

  useEffect(() => {
    setSelectedNode(null);
  }, [period, treemapView]);

  const query = useQuery({
    queryKey: ["activity", period],
    queryFn: () => fetchActivity(period),
    staleTime: 60_000,
  });

  const value = useMemo(
    () => ({
      period,
      setPeriod,
      treemapView,
      setTreemapView,
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
