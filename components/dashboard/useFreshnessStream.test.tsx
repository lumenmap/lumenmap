import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFreshnessStream,
  type UseFreshnessStreamOptions,
} from "@/lib/hooks/useFreshnessStream";

type FreshnessListener = (event: MessageEvent) => void;

// Mock EventSource, installed via vi.stubGlobal("EventSource", MockEventSource)
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];
  public url: string;
  public readyState: number = MockEventSource.CONNECTING;
  public listeners: Record<string, FreshnessListener[]> = {};
  public onopen: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.OPEN;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: FreshnessListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  removeEventListener(event: string, handler: FreshnessListener) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
    }
  }

  emit(event: string, data: unknown) {
    const handlers = this.listeners[event] || [];
    const message = new MessageEvent(event, { data: JSON.stringify(data) });
    for (const h of handlers) {
      h(message);
    }
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }
}

function TestConsumer(props: UseFreshnessStreamOptions) {
  useFreshnessStream(props);
  return <div data-testid="consumer" />;
}

describe("useFreshnessStream hook", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function renderComponent(props: UseFreshnessStreamOptions) {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestConsumer {...props} />
        </QueryClientProvider>,
      );
    });
  }

  it("connects to SSE endpoint and ignores initial connection frame", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderComponent({
      currentPeriod: "1d",
      currentNetwork: "mainnet",
    });

    expect(MockEventSource.instances.length).toBe(1);
    const es = MockEventSource.instances[0];

    // Emit initial event
    act(() => {
      es.emit("freshness", {
        epoch: 1000,
        generatedAt: "2026-10-22T00:00:00.000Z",
        reason: "initial",
      });
      vi.advanceTimersByTime(3000);
    });

    // Should NOT invalidate on initial frame
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("coalesces closely spaced events and invalidates only matching activity query", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderComponent({
      currentPeriod: "1d",
      currentNetwork: "mainnet",
      debounceMs: 500,
    });

    const es = MockEventSource.instances[0];

    // Initial frame
    act(() => {
      es.emit("freshness", { epoch: 1000, reason: "initial" });
    });

    // Rapid burst of 3 cache_set events
    act(() => {
      es.emit("freshness", {
        epoch: 1001,
        keys: ["activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z"],
        reason: "cache_set",
      });
      vi.advanceTimersByTime(100);

      es.emit("freshness", {
        epoch: 1002,
        keys: ["activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z"],
        reason: "cache_set",
      });
      vi.advanceTimersByTime(100);

      es.emit("freshness", {
        epoch: 1003,
        keys: ["activity:v14:mainnet:1d:2026-10-22T00:00:00.000Z"],
        reason: "cache_set",
      });
    });

    // Before debounce timer finishes, no refetch should have fired
    expect(invalidateSpy).not.toHaveBeenCalled();

    // Fast-forward past debounce window
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Exactly one coalesced invalidation should be invoked
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["activity", "1d", "mainnet"],
    });
  });

  it("does not invalidate if updated cache keys do not match current period", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderComponent({
      currentPeriod: "1d",
      currentNetwork: "mainnet",
      debounceMs: 500,
    });

    const es = MockEventSource.instances[0];

    // Emit event for 30d period instead of current 1d
    act(() => {
      es.emit("freshness", {
        epoch: 2000,
        keys: ["activity:v14:mainnet:30d:2026-10-22T00:00:00.000Z"],
        reason: "cache_set",
      });
      vi.advanceTimersByTime(600);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("cleans up EventSource and timers on unmount", () => {
    renderComponent({
      currentPeriod: "1d",
      currentNetwork: "mainnet",
    });

    const es = MockEventSource.instances[0];
    expect(es.readyState).toBe(1);

    act(() => {
      root.unmount();
    });

    expect(es.readyState).toBe(2); // CLOSED
  });

  it("falls back to polling when EventSource is unavailable", () => {
    vi.stubGlobal("EventSource", undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderComponent({
      currentPeriod: "1d",
      currentNetwork: "mainnet",
      fallbackPollingIntervalMs: 10_000,
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    // Advance to polling interval
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["activity", "1d", "mainnet"],
    });
  });
});
