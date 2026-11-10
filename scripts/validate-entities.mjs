#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CATEGORIES = new Set(["defi", "exchange", "wallet", "anchor", "issuer", "other"]);
export const PROTOCOL_TAGS = new Set([
  "dex",
  "lending",
  "stablecoin",
  "rwa",
  "payments",
  "bridge",
  "oracle",
  "infra",
  "wallet",
  "exchange",
  "anchor",
]);
const ADDRESS = /^[GC][A-Z2-7]{55}$/;

// JSON.parse keeps only the last value of a duplicate key. Scan the already parsed
// source so duplicate top-level addresses cannot be silently overwritten.
function duplicateAddresses(source) {
  const stack = [];
  const seen = new Set();
  const duplicates = new Set();

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      let end = i + 1;
      while (end < source.length) {
        if (source[end] === "\\") {
          end += 2;
        } else if (source[end] === '"') {
          break;
        } else {
          end++;
        }
      }
      if (stack.length === 1 && stack[0] === "{") {
        const key = JSON.parse(source.slice(i, end + 1));
        let next = end + 1;
        while (/\s/.test(source[next] ?? "")) next++;
        if (source[next] === ":") {
          if (seen.has(key)) duplicates.add(key);
          seen.add(key);
        }
      }
      i = end;
    } else if (char === "{" || char === "[") {
      stack.push(char);
    } else if (char === "}" || char === "]") {
      stack.pop();
    }
  }

  return duplicates;
}

export function validateEntities(source) {
  let registry;
  try {
    registry = JSON.parse(source);
  } catch (error) {
    return [`Invalid JSON: ${error.message}`];
  }

  if (registry === null || typeof registry !== "object" || Array.isArray(registry)) {
    return ["Registry must be an object keyed by Stellar addresses"];
  }

  const errors = [];
  for (const address of duplicateAddresses(source)) {
    errors.push(`Duplicate address: ${address}`);
  }

  for (const [address, entity] of Object.entries(registry)) {
    if (!ADDRESS.test(address)) {
      errors.push(`${address}: address must be a 56-character G account or C contract ID using uppercase base32`);
    }
    if (entity === null || typeof entity !== "object" || Array.isArray(entity)) {
      errors.push(`${address}: entity must be an object`);
      continue;
    }
    for (const field of ["name", "category", "protocol"]) {
      if (typeof entity[field] !== "string" || !entity[field].trim()) {
        errors.push(`${address}: ${field} must be a non-empty string`);
      }
    }
    if (typeof entity.category === "string" && entity.category.trim() && !CATEGORIES.has(entity.category)) {
      errors.push(`${address}: category must be one of ${[...CATEGORIES].join(", ")}`);
    }
    if (entity.tags !== undefined) {
      if (!Array.isArray(entity.tags) || entity.tags.length === 0) {
        errors.push(`${address}: tags must be a non-empty array of protocol tags`);
      } else {
        const seenTags = new Set();
        for (const tag of entity.tags) {
          if (typeof tag !== "string" || !PROTOCOL_TAGS.has(tag)) {
            errors.push(`${address}: tag "${String(tag)}" must be one of ${[...PROTOCOL_TAGS].join(", ")}`);
          } else if (seenTags.has(tag)) {
            errors.push(`${address}: duplicate tag "${tag}"`);
          } else {
            seenTags.add(tag);
          }
        }
      }
    }
  }

  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const file = resolve(process.argv[2] ?? "data/entities.json");
  try {
    const errors = validateEntities(readFileSync(file, "utf8"));
    if (errors.length) {
      console.error(`${file}: ${errors.length} validation error(s):\n${errors.map((error) => `- ${error}`).join("\n")}`);
      process.exitCode = 1;
    } else {
      console.log(`${file}: entity registry is valid`);
    }
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    process.exitCode = 1;
  }
}
