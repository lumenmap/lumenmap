import { EventEmitter } from "node:events";

export interface FreshnessEventPayload {
  epoch: number;
  generatedAt: string;
  keys?: string[];
  reason?: "cache_set" | "cache_clear" | "heartbeat" | "initial";
}

class FreshnessBroadcaster extends EventEmitter {
  private currentEpoch: number = Date.now();
  private lastGeneratedAt: string = new Date().toISOString();

  constructor() {
    super();
    // Support multiple concurrent client connections without memory leak warning
    this.setMaxListeners(1000);
  }

  public getFreshnessState(): FreshnessEventPayload {
    return {
      epoch: this.currentEpoch,
      generatedAt: this.lastGeneratedAt,
      reason: "initial",
    };
  }

  public notifyCacheRotation(
    keys?: string[],
    reason: "cache_set" | "cache_clear" = "cache_set",
  ): void {
    this.currentEpoch = Date.now();
    this.lastGeneratedAt = new Date().toISOString();

    const payload: FreshnessEventPayload = {
      epoch: this.currentEpoch,
      generatedAt: this.lastGeneratedAt,
      keys,
      reason,
    };

    this.emit("change", payload);
  }

  /** Reset state for tests */
  public reset(epoch = Date.now()): void {
    this.currentEpoch = epoch;
    this.lastGeneratedAt = new Date(epoch).toISOString();
    this.removeAllListeners();
    this.setMaxListeners(1000);
  }
}

const globalForFreshness = globalThis as unknown as {
  freshnessBroadcaster?: FreshnessBroadcaster;
};

export const freshnessBroadcaster =
  globalForFreshness.freshnessBroadcaster ?? new FreshnessBroadcaster();

if (process.env.NODE_ENV !== "production") {
  globalForFreshness.freshnessBroadcaster = freshnessBroadcaster;
}
