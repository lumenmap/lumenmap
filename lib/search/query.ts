import { fuzzyMatchWord, maxTypoDistance } from "@/lib/search/fuzzy";
import {
  SEARCH_RESULT_TYPE_LABELS,
  type GroupedSearchResults,
  type MatchSpan,
  type SearchIndexEntry,
  type SearchQueryResult,
  type SearchResult,
} from "@/lib/search/types";
import type { ProtocolTag } from "@/lib/types";

const DEFAULT_LIMIT = 40;

/**
 * Character ranges within `label` to highlight for `folded` (the
 * lower-cased query). Tries the same exact/prefix/substring tiers
 * `scoreEntry` does (cheap and precise), then falls back to a
 * whole-word highlight for a typo match — edit-distance alignment does
 * not correspond to a single contiguous span, so a typo match highlights
 * the whole matched word rather than claiming more precision than it has.
 */
function matchLabelSpans(label: string, folded: string): Array<[number, number]> | undefined {
  if (!folded) return undefined;
  const foldedLabel = label.toLowerCase();

  if (foldedLabel === folded) return [[0, label.length]];
  if (foldedLabel.startsWith(folded)) return [[0, folded.length]];

  const index = foldedLabel.indexOf(folded);
  if (index >= 0) return [[index, index + folded.length]];

  const fuzzy = fuzzyMatchWord(foldedLabel, folded);
  if (fuzzy) {
    const wordIndex = foldedLabel.indexOf(fuzzy.word);
    if (wordIndex >= 0) return [[wordIndex, wordIndex + fuzzy.word.length]];
  }

  return undefined;
}

function toResult(entry: SearchIndexEntry, folded: string): SearchResult {
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
    opCount: entry.opCount,
    treemapView: entry.treemapView,
    nodeType: entry.nodeType,
    labelMatchSpans: matchLabelSpans(entry.label, folded),
  };
}

function scoreEntry(entry: SearchIndexEntry, rawQuery: string, folded: string): number {
  // A pasted canonical address must beat aliases, assets, and protocols that
  // refer to the same id, regardless of activity count.
  if (
    (entry.type === "account" || entry.type === "contract") &&
    entry.id === rawQuery
  ) return 2_000;

  // Exact canonical id (case-sensitive) — deterministic top hit.
  for (const id of entry.exactIds) {
    if (id === rawQuery) {
      return 1_000;
    }
  }

  // Exact id ignoring case.
  for (const id of entry.exactIds) {
    if (id.toLowerCase() === folded) {
      return 900;
    }
  }

  // Exact term match (names / protocols), case-insensitive.
  for (const term of entry.terms) {
    if (term === folded) {
      return 800;
    }
  }

  // Asset code exact match — keep multiple issuers distinguishable, same score band.
  if (entry.type === "asset" && entry.assetCode?.toLowerCase() === folded) {
    return 750;
  }

  // Prefix match on label / protocol.
  if (entry.label.toLowerCase().startsWith(folded)) {
    return 600;
  }
  if (entry.protocol?.toLowerCase().startsWith(folded)) {
    return 580;
  }
  if (entry.assetCode?.toLowerCase().startsWith(folded)) {
    return 560;
  }

  // Substring match on any term.
  for (const term of entry.terms) {
    if (term.includes(folded)) {
      return 400;
    }
  }

  if (entry.subtitle?.toLowerCase().includes(folded)) {
    return 300;
  }

  // Typo-tolerant fallback, lowest-priority tier — only reached once every
  // exact/prefix/substring check above has failed. Closer matches (smaller
  // edit distance relative to what's tolerated) score higher within this
  // band, but always below a real substring match.
  const tolerance = maxTypoDistance(folded.length);
  if (tolerance > 0) {
    for (const term of entry.terms) {
      const fuzzy = fuzzyMatchWord(term, folded);
      if (fuzzy) {
        return 150 + (tolerance - fuzzy.distance) * 20;
      }
    }
    if (entry.protocol) {
      const fuzzy = fuzzyMatchWord(entry.protocol.toLowerCase(), folded);
      if (fuzzy) {
        return 140 + (tolerance - fuzzy.distance) * 20;
      }
    }
  }

  return 0;
}

/**
 * Query a pre-built search index.
 *
 * - Exact identifiers resolve deterministically (highest score, stable tie-break).
 * - Names and protocols match case-insensitively, with typo tolerance.
 * - Same-code assets remain separate rows distinguished by issuer.
 */
export function searchIndex(
  index: SearchIndexEntry[],
  query: string,
  limit = DEFAULT_LIMIT,
  options?: { tags?: readonly ProtocolTag[] },
): SearchQueryResult {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return { query: rawQuery, groups: [], total: 0 };
  }

  const folded = rawQuery.toLowerCase();
  const resultLimit = Number.isFinite(limit)
    ? Math.max(0, Math.min(DEFAULT_LIMIT, Math.floor(limit)))
    : DEFAULT_LIMIT;
  const requiredTags = options?.tags && options.tags.length > 0
    ? new Set<ProtocolTag>(options.tags)
    : null;

  const ranked = index
    .filter((entry) => {
      if (!requiredTags) return true;
      return (entry.tags ?? []).some((tag) => requiredTags.has(tag));
    })
    .map((entry) => ({ entry, score: scoreEntry(entry, rawQuery, folded) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Deterministic tie-break: higher activity, then stable key.
      const opDelta = (b.entry.opCount ?? 0) - (a.entry.opCount ?? 0);
      if (opDelta !== 0) {
        return opDelta;
      }
      return a.entry.key.localeCompare(b.entry.key);
    })
    .slice(0, limit)
    .map((row) => toResult(row.entry, folded));

  const byType = new Map<SearchResult["type"], SearchResult[]>();
  for (const result of ranked) {
    const list = byType.get(result.type) ?? [];
    list.push(result);
    byType.set(result.type, list);
  }

  // Map insertion order preserves the score order of each group's first hit.
  const groups: GroupedSearchResults[] = [...byType].map(([type, results]) => ({
    type,
    label: SEARCH_RESULT_TYPE_LABELS[type],
    results,
  }));

  return {
    query: rawQuery,
    groups,
    total: ranked.length,
  };
}
