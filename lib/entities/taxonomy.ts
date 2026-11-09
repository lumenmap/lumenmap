import { lookupEntity } from "@/lib/entities/registry";
import type { EntityInfo, ProtocolBar, ProtocolTag, TreemapNode } from "@/lib/types";

export const PROTOCOL_TAXONOMY_TAGS: readonly ProtocolTag[] = [
  "dex",
  "anchor",
  "payments",
  "infra",
  "nft",
  "other",
] as const;

export const PROTOCOL_TAG_LABELS: Record<ProtocolTag, string> = {
  dex: "DEX",
  anchor: "Anchor",
  payments: "Payments",
  infra: "Infra",
  nft: "NFT",
  other: "Other",
};

const VALID_TAG_SET = new Set<string>(PROTOCOL_TAXONOMY_TAGS);

export function isValidProtocolTag(value: unknown): value is ProtocolTag {
  return typeof value === "string" && VALID_TAG_SET.has(value);
}

export function resolveNodeProtocolTags(
  node: TreemapNode,
  labels?: Record<string, EntityInfo>,
): ProtocolTag[] {
  if (Array.isArray(node.meta?.tags) && node.meta.tags.length > 0) {
    return node.meta.tags.filter(isValidProtocolTag);
  }
  const entityId = node.id ?? node.meta?.id;
  if (!entityId) return [];
  const entity = lookupEntity(entityId, labels);
  if (!entity?.tags || !Array.isArray(entity.tags)) return [];
  return entity.tags.filter(isValidProtocolTag);
}

export function matchesSelectedProtocolTags(
  tags: readonly ProtocolTag[] | undefined,
  selectedTags: ReadonlySet<ProtocolTag>,
): boolean {
  if (selectedTags.size === 0) return true;
  if (!tags || tags.length === 0) return false;
  return tags.some((tag) => selectedTags.has(tag));
}

export function filterTreemapByProtocolTags(
  root: TreemapNode,
  selectedTags: ReadonlySet<ProtocolTag>,
  labels?: Record<string, EntityInfo>,
): TreemapNode | null {
  if (selectedTags.size === 0) return root;

  const filterNode = (node: TreemapNode): TreemapNode | null => {
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((child): child is TreemapNode => child !== null);

      if (filteredChildren.length === 0) {
        return null;
      }

      const nextValue = filteredChildren.reduce(
        (sum, child) => sum + (typeof child.value === "number" ? child.value : 0),
        0,
      );

      return {
        ...node,
        value: nextValue,
        children: filteredChildren,
        meta: node.meta
          ? {
              ...node.meta,
              childCount: filteredChildren.length,
            }
          : undefined,
      };
    }

    const nodeTags = resolveNodeProtocolTags(node, labels);
    return matchesSelectedProtocolTags(nodeTags, selectedTags) ? node : null;
  };

  const filteredRoot = filterNode(root);
  if (filteredRoot) return filteredRoot;

  return {
    ...root,
    value: 0,
    children: [],
  };
}

export function filterProtocolBarsByTags(
  bars: readonly ProtocolBar[],
  selectedTags: ReadonlySet<ProtocolTag>,
): ProtocolBar[] {
  if (selectedTags.size === 0) return [...bars];
  return bars
    .filter((bar) => matchesSelectedProtocolTags(bar.tags, selectedTags))
    .map((bar, index) => ({
      ...bar,
      rank: index + 1,
    }));
}
