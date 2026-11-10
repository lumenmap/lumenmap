import { GROUP_LABELS, type TreemapViewId } from "@/lib/constants";
import { getAllEntities, lookupEntity } from "@/lib/entities/registry";
import type {
  ActivityVisualizationResponse,
  ActivityDataset,
  EntityInfo,
  ProtocolTag,
  TreemapNode,
} from "@/lib/types";
import type { SearchIndexEntry, SearchResultType } from "@/lib/search/types";

interface MutableEntry {
  key: string;
  type: SearchResultType;
  label: string;
  subtitle?: string;
  id?: string;
  assetCode?: string;
  issuer?: string;
  protocol?: string;
  category?: string;
  tags?: ProtocolTag[];
  opCount: number;
  treemapView: TreemapViewId;
  nodeType: SearchIndexEntry["nodeType"];
  exactIds: Set<string>;
  terms: Set<string>;
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

function addTerm(entry: MutableEntry, value: string | undefined | null): void {
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  entry.terms.add(normalizeTerm(trimmed));
}

function addExact(entry: MutableEntry, value: string | undefined | null): void {
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  entry.exactIds.add(trimmed);
  // Also allow case-insensitive id match via terms.
  entry.terms.add(normalizeTerm(trimmed));
}

/**
 * Extract a plausible asset code from a display name.
 * Examples: "Circle USDC" → "USDC", "USDC" → "USDC", "Centre USDC (Testnet)" → "USDC"
 */
export function extractAssetCode(name: string): string | null {
  const cleaned = name.replace(/[()[\]]/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  // Prefer an all-caps token of 2–12 chars (Stellar asset codes).
  const tokens = cleaned.split(/[\s/_-]+/).filter(Boolean);
  const upperToken = tokens.find((token) => /^[A-Z0-9]{2,12}$/.test(token));
  if (upperToken) {
    return upperToken;
  }

  // Fallback: last token if it looks like a code ignoring case.
  const last = tokens[tokens.length - 1];
  if (last && /^[A-Za-z0-9]{2,12}$/.test(last)) {
    return last.toUpperCase();
  }

  return null;
}

function finalize(entry: MutableEntry): SearchIndexEntry {
  const fuzzyTerms = new Set<string>();
  for (const text of [entry.label, entry.protocol]) {
    if (!text || text === entry.id) continue;
    const folded = text.toLowerCase();
    fuzzyTerms.add(folded);
    for (const token of folded.match(/[a-z0-9]+/g) ?? []) {
      if (token.length >= 2) fuzzyTerms.add(token);
    }
  }
  return {
    key: entry.key,
    type: entry.type,
    label: entry.label,
    subtitle: entry.subtitle,
    id: entry.id,
    assetCode: entry.assetCode,
    issuer: entry.issuer,
    protocol: entry.protocol,
    category: entry.category,
    tags: entry.tags,
    opCount: entry.opCount > 0 ? entry.opCount : undefined,
    treemapView: entry.treemapView,
    nodeType: entry.nodeType,
    exactIds: [...entry.exactIds],
    terms: [...entry.terms],
    fuzzyTerms: [...fuzzyTerms],
  };
}

function ensureEntry(
  map: Map<string, MutableEntry>,
  key: string,
  seed: Omit<MutableEntry, "key" | "exactIds" | "terms" | "opCount"> & {
    opCount?: number;
  },
): MutableEntry {
  const existing = map.get(key);
  if (existing) {
    if (seed.opCount) {
      existing.opCount = Math.max(existing.opCount, seed.opCount);
    }
    if (!existing.subtitle && seed.subtitle) {
      existing.subtitle = seed.subtitle;
    }
    if (!existing.protocol && seed.protocol) {
      existing.protocol = seed.protocol;
    }
    if (!existing.category && seed.category) {
      existing.category = seed.category;
    }
    if (seed.tags && seed.tags.length > 0) {
      const merged = new Set<ProtocolTag>([
        ...(existing.tags ?? []),
        ...seed.tags,
      ]);
      existing.tags = [...merged];
    }
    if (!existing.label && seed.label) {
      existing.label = seed.label;
    }
    return existing;
  }

  const created: MutableEntry = {
    key,
    type: seed.type,
    label: seed.label,
    subtitle: seed.subtitle,
    id: seed.id,
    assetCode: seed.assetCode,
    issuer: seed.issuer,
    protocol: seed.protocol,
    category: seed.category,
    tags: seed.tags,
    opCount: seed.opCount ?? 0,
    treemapView: seed.treemapView,
    nodeType: seed.nodeType,
    exactIds: new Set(),
    terms: new Set(),
  };
  map.set(key, created);
  return created;
}

function entityLabel(
  id: string,
  labels?: Record<string, EntityInfo>,
): EntityInfo | null {
  return lookupEntity(id, labels) ?? labels?.[id] ?? null;
}

function indexAccountOrContract(
  map: Map<string, MutableEntry>,
  rawId: string,
  kind: "account" | "contract",
  opCount: number,
  labels?: Record<string, EntityInfo>,
  categoryHint?: string,
): void {
  if (!rawId) {
    return;
  }

  const entity = entityLabel(rawId, labels);
  const label = entity?.name ?? rawId;
  const protocol = entity?.protocol;
  const category = entity?.category ?? categoryHint;
  const key = `${kind}:${rawId}`;

  const entry = ensureEntry(map, key, {
    type: kind,
    label,
    subtitle: protocol
      ? `${protocol} · ${rawId}`
      : rawId,
    id: rawId,
    protocol,
    category,
    tags: entity?.tags,
    opCount,
    treemapView: "actors",
    nodeType: kind,
  });

  addExact(entry, rawId);
  addTerm(entry, label);
  addTerm(entry, protocol);
  addTerm(entry, category);
  for (const tag of entity?.tags ?? []) {
    addTerm(entry, tag);
  }

  // Issuer-style entities also contribute an asset identity.
  if (kind === "account" && (category === "issuer" || entity?.category === "issuer")) {
    indexAssetFromIssuer(map, rawId, label, protocol, opCount, labels);
  }
}

function indexAssetFromIssuer(
  map: Map<string, MutableEntry>,
  issuer: string,
  name: string,
  protocol: string | undefined,
  opCount: number,
  labels?: Record<string, EntityInfo>,
): void {
  const entity = entityLabel(issuer, labels);
  const displayName = entity?.name ?? name;
  const assetCode = extractAssetCode(displayName);
  if (!assetCode) {
    return;
  }

  const key = `asset:${assetCode}:${issuer}`;
  const entry = ensureEntry(map, key, {
    type: "asset",
    label: assetCode,
    subtitle: `${displayName} · issuer ${issuer}`,
    id: issuer,
    assetCode,
    issuer,
    protocol: entity?.protocol ?? protocol,
    category: "issuer",
    tags: entity?.tags,
    opCount,
    treemapView: "actors",
    nodeType: "account",
  });

  addExact(entry, issuer);
  addExact(entry, `${assetCode}:${issuer}`);
  addExact(entry, `${assetCode}-${issuer}`);
  addTerm(entry, assetCode);
  addTerm(entry, displayName);
  addTerm(entry, entity?.protocol ?? protocol);
  addTerm(entry, issuer);
  for (const tag of entity?.tags ?? []) {
    addTerm(entry, tag);
  }
}

function indexProtocol(
  map: Map<string, MutableEntry>,
  protocol: string,
  opCount: number,
  sampleId?: string,
): void {
  const normalized = protocol.trim();
  if (!normalized) {
    return;
  }

  // Skip placeholder buckets.
  if (
    normalized === "Unknown Contracts" ||
    normalized === "Unknown Accounts"
  ) {
    return;
  }

  const key = `protocol:${normalizeTerm(normalized)}`;
  const entry = ensureEntry(map, key, {
    type: "protocol",
    label: normalized,
    subtitle: sampleId ? `e.g. ${sampleId}` : undefined,
    id: sampleId,
    protocol: normalized,
    opCount,
    treemapView: "actors",
    nodeType: "entity",
  });

  addTerm(entry, normalized);
  if (sampleId) {
    addExact(entry, sampleId);
  }
}

function indexCategory(
  map: Map<string, MutableEntry>,
  categoryKey: string,
  label: string,
  opCount: number,
): void {
  const key = `category:${categoryKey}`;
  const entry = ensureEntry(map, key, {
    type: "category",
    label,
    subtitle: "Activity category",
    category: categoryKey,
    opCount,
    treemapView: "events",
    nodeType: "category",
  });

  addTerm(entry, label);
  addTerm(entry, categoryKey);
  addExact(entry, categoryKey);
}

function walkTreemap(
  node: TreemapNode<number | string>,
  visit: (node: TreemapNode<number | string>) => void,
): void {
  visit(node);
  for (const child of node.children ?? []) {
    walkTreemap(child, visit);
  }
}

function collectLabelsFromActivity(
  data: Pick<ActivityVisualizationResponse, "treemaps">,
): Record<string, EntityInfo> {
  const labels: Record<string, EntityInfo> = {};

  const consider = (
    id: string | undefined,
    name: string,
    meta?: TreemapNode<number | string>["meta"],
  ) => {
    if (!id) {
      return;
    }
    if (labels[id]) {
      return;
    }
    // Only store when the display name is not just a truncated id.
    if (name && !name.includes("...")) {
      labels[id] = {
        name,
        category: meta?.category ?? (id.startsWith("C") ? "defi" : "account"),
        protocol:
          meta?.protocol ??
          (id.startsWith("C") ? "Unknown Contracts" : "Unknown Accounts"),
      };
    }
  };

  for (const root of Object.values(data.treemaps)) {
    walkTreemap(root, (node) => {
      const id = node.meta?.id ?? node.id;
      consider(id, node.name, node.meta);
    });
  }

  return labels;
}

/**
 * Build a search index from currently loaded dashboard activity data.
 * Only entities present in the response are indexed (no global directory crawl).
 */
type SearchableActivity = ActivityVisualizationResponse &
  Partial<
    Pick<
      ActivityDataset,
      | "accounts"
      | "contracts"
      | "categories"
      | "sorobanFunctions"
      | "sorobanFunctionContracts"
    >
  >;

export function buildSearchIndex(data?: SearchableActivity): SearchIndexEntry[] {
  const map = new Map<string, MutableEntry>();
  const labels = data ? collectLabelsFromActivity(data) : {};

  for (const row of data?.accounts ?? []) {
    indexAccountOrContract(
      map,
      row.account_id,
      "account",
      row.op_count,
      labels,
      undefined,
    );
    const entity = entityLabel(row.account_id, labels);
    if (entity?.protocol) {
      indexProtocol(map, entity.protocol, row.op_count, row.account_id);
    }
  }

  for (const row of data?.contracts ?? []) {
    indexAccountOrContract(
      map,
      row.contract_id,
      "contract",
      row.op_count,
      labels,
      "soroban",
    );
    const entity = entityLabel(row.contract_id, labels);
    if (entity?.protocol) {
      indexProtocol(map, entity.protocol, row.op_count, row.contract_id);
    }
  }

  for (const row of data?.sorobanFunctionContracts ?? []) {
    indexAccountOrContract(
      map,
      row.contract_id,
      "contract",
      row.op_count,
      labels,
      "soroban",
    );
    const entity = entityLabel(row.contract_id, labels);
    if (entity?.protocol) {
      indexProtocol(map, entity.protocol, row.op_count, row.contract_id);
    }
  }

  // Categories from KPI groupings.
  const categoryTotals = new Map<string, number>();
  for (const row of data?.categories ?? []) {
    // type_string is an op type; group label comes from treemap category nodes.
    categoryTotals.set(
      row.type_string,
      (categoryTotals.get(row.type_string) ?? 0) + row.op_count,
    );
  }

  for (const root of Object.values(data?.treemaps ?? {})) {
    walkTreemap(root, (node) => {
      const meta = node.meta;
      if (!meta) {
        return;
      }

      if (meta.type === "category" && meta.category) {
        indexCategory(
          map,
          meta.category,
          GROUP_LABELS[meta.category] ?? node.name,
          Number(meta.opCount ?? node.value ?? 0),
        );
      }

      if (
        (meta.type === "account" || meta.type === "contract") &&
        (meta.id || node.id)
      ) {
        const id = meta.id ?? node.id ?? "";
        indexAccountOrContract(
          map,
          id,
          meta.type,
          Number(meta.opCount ?? node.value ?? 0),
          labels,
          meta.category,
        );
        if (meta.protocol) {
          indexProtocol(
            map,
            meta.protocol,
            Number(meta.opCount ?? node.value ?? 0),
            id,
          );
        }
        // Prefer treemap-provided labels over truncated fallbacks.
        if (node.name && !node.name.includes("...")) {
          labels[id] = {
            name: node.name,
            category: meta.category ?? labels[id]?.category ?? "account",
            protocol: meta.protocol ?? labels[id]?.protocol ?? "Stellar",
          };
          const entry = map.get(`${meta.type}:${id}`);
          if (entry) {
            entry.label = node.name;
            addTerm(entry, node.name);
            if (meta.protocol) {
              entry.protocol = meta.protocol;
              addTerm(entry, meta.protocol);
            }
          }
        }
      }
    });
  }

  // Re-run issuer asset indexing now that labels are fully populated.
  for (const [id, info] of Object.entries(labels)) {
    if (info.category === "issuer" && id.startsWith("G")) {
      const accountEntry = map.get(`account:${id}`);
      indexAssetFromIssuer(
        map,
        id,
        info.name,
        info.protocol,
        accountEntry?.opCount ?? 0,
        labels,
      );
    }
  }

  // Keep directory entities and their protocol names searchable even when
  // they are outside the currently loaded activity window.
  for (const [id, info] of Object.entries(getAllEntities())) {
    if (!/^[GC][A-Z2-7]{55}$/.test(id)) continue;
    indexAccountOrContract(
      map,
      id,
      id.startsWith("C") ? "contract" : "account",
      0,
      labels,
    );
    indexProtocol(map, info.protocol, 0, id);
  }

  return [...map.values()].map(finalize);
}
