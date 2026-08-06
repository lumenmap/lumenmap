export type CacheOutcome = "hit" | "miss" | "coalesced";

export type Endpoint = "activity";

export type HttpStatusClass = "2xx" | "4xx" | "5xx";

/** Documented unit: bytes */
export const RESPONSE_SIZE_UNIT = "bytes";

export interface CounterDimensions {
  endpoint: Endpoint;
  cache_outcome?: CacheOutcome;
  [key: string]: string | undefined;
}

export interface HistogramDimensions {
  endpoint: Endpoint;
  period: string;
  status?: HttpStatusClass;
  [key: string]: string | undefined;
}