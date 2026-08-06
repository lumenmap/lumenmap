export type AssetType = "native" | "credit_alphanum4" | "credit_alphanum12";

export interface NativeAsset {
  type: "native";
  code: "XLM";
}

export interface IssuedAsset {
  type: "credit_alphanum4" | "credit_alphanum12";
  code: string;
  issuer: string;
}

export type AssetIdentity = NativeAsset | IssuedAsset;

export class InvalidAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAssetError";
  }
}

/**
 * Normalizes Hubble asset fields into a canonical AssetIdentity.
 * Native XLM has one canonical identity and no fabricated issuer.
 * Issued assets require both code and issuer.
 * Malformed and incomplete rows return a typed failure rather than a plausible asset.
 */
export function normalizeAsset(
  type: string,
  code?: string | null,
  issuer?: string | null
): AssetIdentity {
  const c = code?.trim() || null;
  const i = issuer?.trim() || null;

  if (type === "native") {
    // Some systems set code to XLM for native, but it has no issuer
    if (i) {
      throw new InvalidAssetError("Native asset cannot have an issuer");
    }
    return { type: "native", code: "XLM" };
  }

  if (type === "credit_alphanum4" || type === "credit_alphanum12") {
    if (!c || !i) {
      throw new InvalidAssetError(
        `Issued asset of type ${type} must have both code and issuer`
      );
    }
    if (type === "credit_alphanum4" && c.length > 4) {
      throw new InvalidAssetError(
        "credit_alphanum4 code must be 1-4 characters"
      );
    }
    if (type === "credit_alphanum12" && (c.length < 5 || c.length > 12)) {
      throw new InvalidAssetError(
        "credit_alphanum12 code must be 5-12 characters"
      );
    }
    return { type, code: c, issuer: i };
  }

  throw new InvalidAssetError(`Unknown asset type: ${type}`);
}

/**
 * Returns a stable serialization key for an AssetIdentity.
 * native -> "native"
 * issued -> "code:issuer"
 */
export function getAssetKey(asset: AssetIdentity): string {
  if (asset.type === "native") {
    return "native";
  }
  return `${asset.code}:${asset.issuer}`;
}

/**
 * Parses a stable serialization key back into an AssetIdentity.
 */
export function parseAssetKey(key: string): AssetIdentity {
  if (key === "native") {
    return { type: "native", code: "XLM" };
  }
  const parts = key.split(":");
  if (parts.length !== 2) {
    throw new InvalidAssetError("Invalid asset key format");
  }
  const [code, issuer] = parts;
  if (!code || !issuer) {
    throw new InvalidAssetError("Asset key missing code or issuer");
  }
  
  const type = code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12";
  if (type === "credit_alphanum12" && code.length > 12) {
    throw new InvalidAssetError("Code too long for valid asset");
  }

  return { type, code, issuer };
}
