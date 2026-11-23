import entities from "@/data/entities.json";
import directory from "@/data/directory.json";
import type { EntityInfo, ProtocolTag } from "@/lib/types";

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

export function getProtocolTag(protocol: string): ProtocolTag {
  const normalized = protocol.trim().toLowerCase();
  return Object.values(entities as Record<string, EntityInfo>).find(
    (entity) => entity.protocol.toLowerCase() === normalized,
  )?.tag ?? "other";
}
