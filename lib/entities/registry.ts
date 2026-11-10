import entities from "@/data/entities.json";
import directory from "@/data/directory.json";
import { PROTOCOL_TAGS, type EntityInfo, type ProtocolTag } from "@/lib/types";

export { PROTOCOL_TAGS, type ProtocolTag };

const PROTOCOL_TAG_SET = new Set<string>(PROTOCOL_TAGS);

export function isValidProtocolTag(
  value: string | null | undefined,
): value is ProtocolTag {
  return typeof value === "string" && PROTOCOL_TAG_SET.has(value);
}

const registry: Record<string, EntityInfo> = {
  ...(directory as Record<string, EntityInfo>),
  ...(entities as Record<string, EntityInfo>),
};

export function lookupEntity(
  id: string,
  labels?: Record<string, EntityInfo>,
): EntityInfo | null {
  return registry[id] ?? labels?.[id] ?? null;
}

export function getProtocolLabel(
  id: string,
  labels?: Record<string, EntityInfo>,
): string {
  const entity = lookupEntity(id, labels);
  if (entity) {
    return entity.protocol;
  }

  if (id.startsWith("C")) {
    return "Unknown Contracts";
  }

  return "Unknown Accounts";
}

export function getDisplayName(
  id: string,
  labels?: Record<string, EntityInfo>,
): string {
  const entity = lookupEntity(id, labels);
  if (entity) {
    return entity.name;
  }

  if (id.length > 12) {
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  }

  return id;
}

export function getAllEntities(): Record<string, EntityInfo> {
  return registry;
}

export function getEntityTags(
  id: string,
  labels?: Record<string, EntityInfo>,
): ProtocolTag[] {
  const entity = lookupEntity(id, labels);
  if (!entity?.tags || !Array.isArray(entity.tags)) {
    return [];
  }
  return entity.tags.filter(isValidProtocolTag);
}

export function filterEntitiesByTags(
  source: Record<string, EntityInfo>,
  selectedTags: readonly ProtocolTag[],
): Record<string, EntityInfo> {
  const validSelected = selectedTags.filter(isValidProtocolTag);
  if (validSelected.length === 0) {
    return { ...source };
  }

  const tagSet = new Set<ProtocolTag>(validSelected);
  const filtered: Record<string, EntityInfo> = {};

  for (const [address, entity] of Object.entries(source)) {
    const entityTags = entity.tags ?? [];
    if (entityTags.some((tag) => tagSet.has(tag))) {
      filtered[address] = entity;
    }
  }

  return filtered;
}
