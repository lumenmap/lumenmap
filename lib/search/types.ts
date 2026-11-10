import type { TreemapViewId } from "@/lib/constants";
import type { ProtocolTag, TreemapNodeType } from "@/lib/types";

/** Result kinds surfaced in the dashboard search UI. */
export type SearchResultType =
  | "account"
  | "contract"
  | "protocol"
  | "asset"
  | "category";

export const SEARCH_RESULT_TYPE_LABELS: Record<SearchResultType, string> = {
  account: "Accounts",
  contract: "Contracts",
  protocol: "Protocols",
  asset: "Assets",
  category: "Categories",
};

/** Preferred display order for grouped results. */
export const SEARCH_RESULT_TYPE_ORDER: SearchResultType[] = [
  "account",
  "contract",
  "asset",
  "protocol",
  "category",
];

export interface SearchResult {
  /** Stable unique key within the index. */
  key: string;
  type: SearchResultType;
  /** Primary display label. */
  label: string;
  /** Secondary line (issuer, protocol, truncated id, etc.). */
  subtitle?: string;
  /** Canonical on-chain address / contract id when applicable. */
  id?: string;
  /** Asset code for same-code asset disambiguation. */
  assetCode?: string;
  /** Issuer address for assets. */
  issuer?: string;
  protocol?: string;
  category?: string;
  tags?: ProtocolTag[];
  opCount?: number;
  /** Which treemap view best hosts this result. */
  treemapView: TreemapViewId;
  /** Meta type mirrored onto SelectedNode when opening context. */
  nodeType: TreemapNodeType;
  /**
   * Character ranges within `label` (as `[start, end)` pairs) to
   * highlight as the matched portion. Omitted when the match came from a
   * different field (protocol, subtitle, asset code) with nothing in
   * `label` itself to highlight, or when no match tier applies to it.
   */
  labelMatchSpans?: Array<[number, number]>;
}

export interface SearchIndexEntry extends SearchResult {
  /** Exact-match tokens (case-sensitive canonical ids). */
  exactIds: string[];
  /** Case-folded tokens used for name / protocol matching. */
  terms: string[];
  /** Pre-tokenized display names and protocol labels for typo matching. */
  fuzzyTerms: string[];
}

export interface GroupedSearchResults {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
}

export interface SearchQueryResult {
  query: string;
  groups: GroupedSearchResults[];
  total: number;
}
