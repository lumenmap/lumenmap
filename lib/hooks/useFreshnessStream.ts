"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Period } from "@/lib/types";
import type { DashboardNetworkId } from "@/lib/network";

export interface FreshnessEventPayload {
  epoch: number;
  generatedAt: string;
  keys?: string[];
  reason?: "cache_set" | "cache_clear" | "heartbeat" | "initial";
}

export interface UseFreshnessStreamOptions {
  enabled?: boolean;
  endpoint?: string;
  currentPeriod?: Period;
  currentNetwork?: DashboardNetworkId;
  debounceMs?: number;
  fallbackPollingIntervalMs?: number; // default: 5 minutes
  onFreshnessChange?: (payload: FreshnessEventPayload) => void;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_FALLBACK_POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if a cache key matches the given activity query parameters.
 * E.g. key format: "activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z"
 */
export function isKeyMatchingActivity(
  key: string,
  period?: Period,
  network?: DashboardNetworkId,
): boolean {
  if (!key.startsWith("activity:")) {
    return false;
  }
  const parts = key.split(":");
  // parts[0] = 'activity', parts[1] = version ('v14'), parts[2] = network, parts[3] = period
  if (parts.length < 4) {
    return true; // Conservative match for any activity key
  }
  const keyNetwork = parts[2];
  const keyPeriod = parts[3];

  if (network && keyNetwork && keyNetwork !== network) {
    return false;
  }
  if (period && keyPeriod && keyPeriod !== period) {
    return false;
  }
  return true;
}

export function useFreshnessStream({
  enabled = true,
  endpoint = "/api/v1/events/freshness",
  currentPeriod,
  currentNetwork,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  fallbackPollingIntervalMs = DEFAULT_FALLBACK_POLLING_INTERVAL_MS,
  onFreshnessChange,
}: UseFreshnessStreamOptions = {}) {
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEpochRef = useRef<number | null>(null);
  const onFreshnessChangeRef = useRef(onFreshnessChange);
  const currentPeriodRef = useRef(currentPeriod);
  const currentNetworkRef = useRef(currentNetwork);

  // Keep refs in sync with the latest render. Refs are only written inside
  // effects (never during render), and this effect is declared before the
  // subscription effect so the refs are fresh before it re-runs.
  useEffect(() => {
    onFreshnessChangeRef.current = onFreshnessChange;
    currentPeriodRef.current = currentPeriod;
    currentNetworkRef.current = currentNetwork;
  }, [onFreshnessChange, currentPeriod, currentNetwork]);

  useEffect(() => {
    if (!enabled) return;

    // Coalesced / Debounced invalidation to prevent duplicate request storms
    const triggerCoalescedInvalidation = (
      epoch: number,
      keys?: string[],
      payload?: FreshnessEventPayload,
    ) => {
      // Ignore identical epoch if already handled
      if (lastEpochRef.current === epoch) {
        return;
      }
      lastEpochRef.current = epoch;

      if (payload && onFreshnessChangeRef.current) {
        onFreshnessChangeRef.current(payload);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const period = currentPeriodRef.current;
        const network = currentNetworkRef.current;

        // If specific keys were supplied, check whether they match current activity period/network
        if (keys && keys.length > 0) {
          const hasMatchingKey = keys.some((k) =>
            isKeyMatchingActivity(k, period, network),
          );
          if (!hasMatchingKey) {
            // Updated cache key does not affect currently viewed activity queries
            return;
          }
        }

        // Invalidate matching TanStack Query queries
        if (period && network) {
          queryClient.invalidateQueries({
            queryKey: ["activity", period, network],
          });
        } else {
          queryClient.invalidateQueries({
            queryKey: ["activity"],
          });
        }

        debounceTimerRef.current = null;
      }, debounceMs);
    };

    // Feature detection: Check for browser EventSource support
    const supportsSSE =
      typeof window !== "undefined" && typeof window.EventSource !== "undefined";

    if (!supportsSSE) {
      // Fallback: Polling every N minutes
      const interval = setInterval(() => {
        const period = currentPeriodRef.current;
        const network = currentNetworkRef.current;
        if (period && network) {
          queryClient.invalidateQueries({
            queryKey: ["activity", period, network],
          });
        } else {
          queryClient.invalidateQueries({
            queryKey: ["activity"],
          });
        }
      }, fallbackPollingIntervalMs);

      return () => {
        clearInterval(interval);
      };
    }

    let eventSource: EventSource | null = null;
    let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;

    const startFallbackPolling = () => {
      if (fallbackPollTimer) return;
      fallbackPollTimer = setInterval(() => {
        const period = currentPeriodRef.current;
        const network = currentNetworkRef.current;
        if (period && network) {
          queryClient.invalidateQueries({
            queryKey: ["activity", period, network],
          });
        } else {
          queryClient.invalidateQueries({
            queryKey: ["activity"],
          });
        }
      }, fallbackPollingIntervalMs);
    };

    const stopFallbackPolling = () => {
      if (fallbackPollTimer) {
        clearInterval(fallbackPollTimer);
        fallbackPollTimer = null;
      }
    };

    try {
      eventSource = new EventSource(endpoint);

      eventSource.addEventListener("freshness", (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as FreshnessEventPayload;
          if (payload && typeof payload.epoch === "number") {
            // Don't refetch on initial connect frame unless epoch differs from known state
            if (payload.reason === "initial") {
              if (lastEpochRef.current === null) {
                lastEpochRef.current = payload.epoch;
                if (onFreshnessChangeRef.current) {
                  onFreshnessChangeRef.current(payload);
                }
                return;
              }
            }

            triggerCoalescedInvalidation(payload.epoch, payload.keys, payload);
          }
        } catch {
          // Ignore malformed payloads safely
        }
      });

      eventSource.onerror = () => {
        // If native reconnect fails or connection is closed, activate fallback polling
        if (eventSource?.readyState === EventSource.CLOSED) {
          startFallbackPolling();
        }
      };

      eventSource.onopen = () => {
        stopFallbackPolling();
      };
    } catch {
      startFallbackPolling();
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      stopFallbackPolling();
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [
    enabled,
    endpoint,
    debounceMs,
    fallbackPollingIntervalMs,
    queryClient,
  ]);
}
