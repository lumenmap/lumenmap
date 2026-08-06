export type StellarExpertNetwork = "public" | "testnet";

export type StellarExpertEntityKind = "account" | "contract";

/** StrKey alphabet used by Stellar account / contract IDs. */
const STRKEY_BODY = /^[A-Z2-7]+$/;

/**
 * LumenMap dashboard is mainnet-only today ("Mainnet" badge).
 * Keep the helper centralized so testnet can be wired later without UI churn.
 */
export function resolveStellarExpertNetwork(): StellarExpertNetwork {
  return "public";
}

export function isValidStellarAccountId(id: string): boolean {
  return id.length === 56 && id.startsWith("G") && STRKEY_BODY.test(id);
}

export function isValidStellarContractId(id: string): boolean {
  return id.length === 56 && id.startsWith("C") && STRKEY_BODY.test(id);
}

/**
 * Resolves whether an identifier is a linkable account or contract.
 * Malformed IDs return null even when a meta type is provided.
 */
export function resolveStellarExpertEntityKind(
  id: string | undefined,
  type?: string,
): StellarExpertEntityKind | null {
  if (!id) {
    return null;
  }

  if (type === "account") {
    return isValidStellarAccountId(id) ? "account" : null;
  }

  if (type === "contract") {
    return isValidStellarContractId(id) ? "contract" : null;
  }

  if (isValidStellarAccountId(id)) {
    return "account";
  }

  if (isValidStellarContractId(id)) {
    return "contract";
  }

  return null;
}

/**
 * Builds a network-correct Stellar Expert URL, or null for malformed IDs.
 * Accounts: /explorer/{network}/account/{G...}
 * Contracts: /explorer/{network}/contract/{C...}
 */
export function buildStellarExpertUrl(
  id: string | undefined,
  type?: string,
  network: StellarExpertNetwork = resolveStellarExpertNetwork(),
): string | null {
  const kind = resolveStellarExpertEntityKind(id, type);
  if (!kind || !id) {
    return null;
  }

  return `https://stellar.expert/explorer/${network}/${kind}/${id}`;
}

export function stellarExpertLinkLabel(kind: StellarExpertEntityKind): string {
  return kind === "account"
    ? "View account on Stellar Expert"
    : "View contract on Stellar Expert";
}

export function stellarExpertAccessibleName(
  id: string,
  kind: StellarExpertEntityKind,
): string {
  return `${stellarExpertLinkLabel(kind)} ${id} (opens in a new tab)`;
}
