import { METHODOLOGY_VERSION } from "@/lib/metrics/methodology";
import type {
  ActivityKpis,
  ActivityVisualizationResponse,
  Period,
  ProtocolSummary,
  TreemapNode,
} from "@/lib/types";

export type MarkdownCategoryRow = {
  name: string;
  value: number;
  share: number | null;
};

export type MarkdownProtocolRow = {
  name: string;
  opCount: number;
  share: number;
  rank: number;
};

export type DashboardMarkdownInput = {
  period: Period;
  start?: string;
  end?: string;
  kpis: ActivityKpis;
  categories: MarkdownCategoryRow[];
  protocols: MarkdownProtocolRow[];
  methodologyVersion: string;
  permalink: string;
  source?: string;
  /** Override for fixture-stable tests; defaults to ISO now. */
  generatedAt?: string;
};

const DEFAULT_TOP_N = 5;

/** Locale-stable number formatting for GitHub-friendly pastes. */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatShare(share: number | null | undefined): string {
  if (share === null || share === undefined || !Number.isFinite(share)) {
    return "";
  }
  return ` (${formatNumber(share)}%)`;
}

/**
 * Stable sort: value descending, then name ascending (localeCompare).
 * Keeps fixture snapshots deterministic across runs.
 */
export function sortCategoriesForMarkdown(
  rows: readonly MarkdownCategoryRow[],
): MarkdownCategoryRow[] {
  return [...rows].sort((a, b) => {
    const byValue = b.value - a.value;
    if (byValue !== 0) return byValue;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Stable sort: rank ascending, then name. Falls back to opCount when ranks tie.
 */
export function sortProtocolsForMarkdown(
  rows: readonly MarkdownProtocolRow[],
): MarkdownProtocolRow[] {
  return [...rows].sort((a, b) => {
    const byRank = a.rank - b.rank;
    if (byRank !== 0) return byRank;
    const byOps = b.opCount - a.opCount;
    if (byOps !== 0) return byOps;
    return a.name.localeCompare(b.name);
  });
}

/** Pull top-level category tiles from an events (or similar) treemap root. */
export function extractCategoriesFromTreemap(
  root: TreemapNode | undefined | null,
): MarkdownCategoryRow[] {
  if (!root?.children?.length) return [];

  const rows: MarkdownCategoryRow[] = [];
  for (const child of root.children) {
    const metaType = child.meta?.type;
    if (metaType && metaType !== "category" && metaType !== "root") {
      // Skip entity / account / contract leaves if mixed at this level.
      if (metaType === "entity" || metaType === "account" || metaType === "contract") {
        continue;
      }
    }
    const value =
      typeof child.value === "number"
        ? child.value
        : Number(child.value ?? child.meta?.opCount ?? 0);
    if (!Number.isFinite(value)) continue;
    rows.push({
      name: child.name,
      value,
      share:
        typeof child.meta?.share === "number" && Number.isFinite(child.meta.share)
          ? child.meta.share
          : null,
    });
  }
  return sortCategoriesForMarkdown(rows);
}

export function extractProtocolsFromSummary(
  summary: ProtocolSummary | undefined | null,
): MarkdownProtocolRow[] {
  if (!summary?.bars?.length) return [];
  const rows: MarkdownProtocolRow[] = summary.bars.map((bar) => ({
    name: bar.protocol,
    opCount: bar.opCount,
    share: bar.share,
    rank: bar.rank,
  }));
  return sortProtocolsForMarkdown(rows);
}

function kpiLines(kpis: ActivityKpis): string[] {
  return [
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Total operations | ${formatNumber(kpis.totalOps.value)} |`,
    `| Soroban share | ${formatNumber(kpis.sorobanShare.value)}% |`,
    `| Top category | ${kpis.topCategory} |`,
    `| Active contracts | ${formatNumber(kpis.activeContracts.value)} |`,
    `| Active wallets | ${formatNumber(kpis.activeWallets.value)} |`,
    `| Active destination accounts | ${formatNumber(kpis.activeDestinationAccounts.value)} |`,
  ];
}

function listSection(
  title: string,
  items: string[],
): string[] {
  if (items.length === 0) {
    return [`## ${title}`, "", "_None available._", ""];
  }
  return [`## ${title}`, "", ...items.map((item, i) => `${i + 1}. ${item}`), ""];
}

/**
 * Builds a GitHub-issue-friendly Markdown snapshot of dashboard KPIs,
 * top categories, and top protocols. Pure and fixture-stable when
 * `generatedAt` and list inputs are fixed.
 */
export function buildDashboardMarkdownSnapshot(
  input: DashboardMarkdownInput,
  options: { topN?: number } = {},
): string {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const categories = sortCategoriesForMarkdown(input.categories).slice(0, topN);
  const protocols = sortProtocolsForMarkdown(input.protocols).slice(0, topN);

  const periodRange =
    input.start && input.end
      ? ` (${input.start} → ${input.end})`
      : "";

  const categoryItems = categories.map(
    (row) =>
      `**${row.name}** — ${formatNumber(row.value)}${formatShare(row.share)}`,
  );
  const protocolItems = protocols.map(
    (row) =>
      `**${row.name}** — ${formatNumber(row.opCount)} ops${formatShare(row.share)}`,
  );

  const lines = [
    `# LumenMap dashboard snapshot`,
    "",
    `**Period:** ${input.period}${periodRange}`,
    `**Permalink:** ${input.permalink}`,
    `**Methodology version:** ${input.methodologyVersion}`,
    ...(input.source ? [`**Source:** ${input.source}`] : []),
    `**Generated:** ${generatedAt}`,
    "",
    `## KPIs`,
    "",
    ...kpiLines(input.kpis),
    "",
    ...listSection("Top categories", categoryItems),
    ...listSection("Top protocols", protocolItems),
    `---`,
    "",
    `_Public dashboard data only. Excludes non-public identifiers._`,
    "",
  ];

  return lines.join("\n");
}

/** Convenience: assemble markdown from a live activity visualization payload. */
export function buildMarkdownFromActivity(
  data: ActivityVisualizationResponse,
  permalink: string,
  options: {
    methodologyVersion?: string;
    generatedAt?: string;
    topN?: number;
    treemapSlot?: keyof ActivityVisualizationResponse["treemaps"];
  } = {},
): string {
  const slot = options.treemapSlot ?? "events";
  const root = data.treemaps?.[slot] as TreemapNode | undefined;
  return buildDashboardMarkdownSnapshot(
    {
      period: data.period,
      start: data.start,
      end: data.end,
      kpis: data.kpis,
      categories: extractCategoriesFromTreemap(root),
      protocols: extractProtocolsFromSummary(data.protocols),
      methodologyVersion: options.methodologyVersion ?? METHODOLOGY_VERSION,
      permalink,
      source: data.source,
      generatedAt: options.generatedAt,
    },
    { topN: options.topN },
  );
}
