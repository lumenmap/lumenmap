import type {
  CounterDimensions,
  HistogramDimensions,
} from "./types";

export interface HistogramStats {
  count: number;
  sum: number;
  min: number;
  max: number;
}

function encodeDimensions(
  dimensions: CounterDimensions | HistogramDimensions,
): string {
  return JSON.stringify(
    Object.keys(dimensions)
      .sort()
      .map((key) => [key, dimensions[key]]),
  );
}

export class MetricsRegistry {
  readonly counters = new Map<string, number>();
  private histograms = new Map<string, HistogramStats>();

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  increment(dimensions: CounterDimensions): void {
    const key = encodeDimensions(dimensions);
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  readCounter(dimensions: CounterDimensions): number {
    return this.counters.get(encodeDimensions(dimensions)) ?? 0;
  }

  record(dimensions: HistogramDimensions, value: number): void {
    const key = encodeDimensions(dimensions);
    const current = this.histograms.get(key);

    if (current === undefined) {
      this.histograms.set(key, {
        count: 1,
        sum: value,
        min: value,
        max: value,
      });
      return;
    }

    current.count += 1;
    current.sum += value;
    current.min = Math.min(current.min, value);
    current.max = Math.max(current.max, value);
  }

  readHistogram(dimensions: HistogramDimensions): HistogramStats | null {
    return this.histograms.get(encodeDimensions(dimensions)) ?? null;
  }
}

export const metrics = new MetricsRegistry();
