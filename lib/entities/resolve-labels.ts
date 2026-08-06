import { getCached, setCache } from "@/lib/hubble/cache";
import { lookupEntity } from "@/lib/entities/registry";
import type { EntityInfo } from "@/lib/types";

const STELLAR_EXPERT_DIRECTORY =
  "https://api.stellar.expert/explorer/public/directory";

/** Number of addresses sent in each HTTP request to the directory API. */
const BATCH_SIZE = 50;

const LABEL_CACHE_TTL_SECONDS = 86_400;

/**
 * Safe defaults used when caller-supplied configuration is absent or invalid.
 *
 * - `timeoutMs`: maximum time (ms) to wait for a single directory request.
 *   Requests that exceed this deadline are aborted and treated as an empty
 *   result so the remaining batches and the home-domain fallback can still run.
 *
 * - `concurrency`: maximum number of directory HTTP requests that may be in
 *   flight simultaneously.  A value of 1 means strictly sequential; higher
 *   values allow parallel fetches without overwhelming the provider.
 */
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_CONCURRENCY = 3;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60_000;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 20;

interface DirectoryRecord {
  address: string;
  name?: string;
  domain?: string;
  tags?: string[];
}

interface DirectoryResponse {
  _embedded?: {
    records?: DirectoryRecord[];
  };
}

export interface DirectoryConfig {
  /**
   * Milliseconds before a single directory request is aborted.
   * Clamped to [100, 60000]. Defaults to 5000.
   */
  timeoutMs?: number;

  /**
   * Maximum number of concurrent directory requests.
   * Clamped to [1, 20]. Defaults to 3.
   */
  concurrency?: number;
}

export interface ResolveLabelsOptions {
  fetchHomeDomains?: (ids: string[]) => Promise<Record<string, EntityInfo>>;
  /** Override fetch for testing. Defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Timeout and concurrency settings. Safe defaults applied for invalid values. */
  directoryConfig?: DirectoryConfig;
}

/**
 * Validate and normalise directory configuration, applying documented safe
 * defaults for any value that is absent, NaN, or out of range.
 */
export function resolveDirectoryConfig(raw: DirectoryConfig | undefined): Required<DirectoryConfig> {
  let timeoutMs = raw?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let concurrency = raw?.concurrency ?? DEFAULT_CONCURRENCY;

  if (!Number.isFinite(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  if (!Number.isFinite(concurrency) || concurrency < MIN_CONCURRENCY || concurrency > MAX_CONCURRENCY) {
    concurrency = DEFAULT_CONCURRENCY;
  }

  return {
    timeoutMs: Math.round(timeoutMs),
    concurrency: Math.round(concurrency),
  };
}

function tagToCategory(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) {
    return "account";
  }

  const priority = [
    "exchange",
    "anchor",
    "issuer",
    "wallet",
    "defi",
    "custodian",
    "sdf",
  ];

  for (const tag of priority) {
    if (tags.includes(tag)) {
      return tag === "sdf" ? "foundation" : tag;
    }
  }

  return tags[0];
}

function formatDomainLabel(domain: string): string {
  const normalized = domain.replace(/^www\./, "");
  const root = normalized.split(".")[0] ?? normalized;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function recordToEntity(record: DirectoryRecord): EntityInfo {
  return {
    name: record.name?.trim() || formatDomainLabel(record.domain ?? record.address),
    category: tagToCategory(record.tags),
    protocol: record.domain?.replace(/^www\./, "") ?? record.name ?? "Stellar",
  };
}

function homeDomainToEntity(homeDomain: string): EntityInfo {
  const protocol = homeDomain.replace(/^www\./, "");
  return {
    name: formatDomainLabel(protocol),
    category: "account",
    protocol,
  };
}

/**
 * Fetch a single batch of addresses from the directory API.
 *
 * Each call is raced against an AbortController deadline so a slow or
 * unresponsive server never blocks the entire resolution pipeline.  A failed
 * or timed-out request returns an empty map rather than throwing, allowing
 * successful batches to be preserved and the home-domain fallback to run.
 */
async function fetchDirectoryBatch(
  ids: string[],
  config: Required<DirectoryConfig>,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<Record<string, EntityInfo>> {
  const params = new URLSearchParams();
  for (const id of ids) {
    params.append("address[]", id);
  }
  params.set("limit", String(ids.length));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchFn(
      `${STELLAR_EXPERT_DIRECTORY}?${params.toString()}`,
      {
        signal: controller.signal,
        next: { revalidate: LABEL_CACHE_TTL_SECONDS },
      } as RequestInit,
    );

    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as DirectoryResponse;
    const records = payload._embedded?.records ?? [];
    const resolved: Record<string, EntityInfo> = {};

    for (const record of records) {
      if (!record.address) {
        continue;
      }
      resolved[record.address] = recordToEntity(record);
    }

    return resolved;
  } catch {
    // Covers AbortError (timeout) and network errors.
    // Return an empty result so successful batches are preserved.
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Process an array of tasks with a bounded concurrency limit.
 *
 * At most `concurrency` tasks run simultaneously.  Each task is a thunk that
 * returns a Promise.  Results are collected in input order.
 */
async function withBoundedConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

function cacheResolvedLabels(resolved: Record<string, EntityInfo>): void {
  for (const [id, entity] of Object.entries(resolved)) {
    setCache(`label:${id}`, entity, LABEL_CACHE_TTL_SECONDS);
  }
}

export async function resolveEntityLabels(
  ids: string[],
  options: ResolveLabelsOptions = {},
): Promise<Record<string, EntityInfo>> {
  const config = resolveDirectoryConfig(options.directoryConfig);
  const fetchFn = options.fetch ?? globalThis.fetch;

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const resolved: Record<string, EntityInfo> = {};
  const pending: string[] = [];

  for (const id of uniqueIds) {
    const local = lookupEntity(id);
    if (local) {
      resolved[id] = local;
      continue;
    }

    const cacheKey = `label:${id}`;
    const cached = getCached<EntityInfo>(cacheKey);
    if (cached) {
      resolved[id] = cached;
      continue;
    }

    pending.push(id);
  }

  // Build one task thunk per batch.  withBoundedConcurrency controls how many
  // of these run in parallel, capping active directory requests at
  // config.concurrency.
  const batches: Array<() => Promise<void>> = [];
  for (let index = 0; index < pending.length; index += BATCH_SIZE) {
    const batch = pending.slice(index, index + BATCH_SIZE);
    batches.push(async () => {
      const batchResolved = await fetchDirectoryBatch(batch, config, fetchFn);
      Object.assign(resolved, batchResolved);
      cacheResolvedLabels(batchResolved);
    });
  }

  await withBoundedConcurrency(batches, config.concurrency);

  // Fall back to Hubble home-domain resolution for any G… accounts that the
  // directory did not resolve.
  const unresolved = pending.filter((id) => !resolved[id]);
  const accountIds = unresolved.filter((id) => id.startsWith("G"));

  if (accountIds.length > 0 && options.fetchHomeDomains) {
    try {
      const homeDomains = await options.fetchHomeDomains(accountIds);
      Object.assign(resolved, homeDomains);
      cacheResolvedLabels(homeDomains);
    } catch {
      // Ignore home domain lookup failures.
    }
  }

  return resolved;
}

export function homeDomainsToEntities(
  rows: { account_id: string; home_domain: string }[],
): Record<string, EntityInfo> {
  const resolved: Record<string, EntityInfo> = {};

  for (const row of rows) {
    if (!row.home_domain) {
      continue;
    }
    resolved[row.account_id] = homeDomainToEntity(row.home_domain);
  }

  return resolved;
}

export function collectTreemapIds(raw: {
  accounts: { account_id: string }[];
  contracts: { contract_id: string }[];
  sorobanFunctionContracts: { contract_id: string }[];
  usdcAccounts?: { account_id: string }[];
}): string[] {
  return [
    ...raw.accounts.map((row) => row.account_id),
    ...raw.contracts.map((row) => row.contract_id),
    ...raw.sorobanFunctionContracts.map((row) => row.contract_id),
    ...(raw.usdcAccounts?.map((row) => row.account_id) ?? []),
  ];
}
