"use client";

import { ExternalLink } from "lucide-react";
import {
  buildStellarExpertUrl,
  resolveStellarExpertEntityKind,
  stellarExpertAccessibleName,
  stellarExpertLinkLabel,
} from "@/lib/stellar-expert";
import { cn } from "@/lib/utils";

interface StellarExpertLinkProps {
  address: string;
  type?: string;
  className?: string;
}

export function StellarExpertLink({
  address,
  type,
  className,
}: StellarExpertLinkProps) {
  const kind = resolveStellarExpertEntityKind(address, type);
  const href = buildStellarExpertUrl(address, type);

  if (!kind || !href) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-stellar-light transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stellar rounded-sm",
        className,
      )}
      aria-label={stellarExpertAccessibleName(address, kind)}
    >
      <span>{stellarExpertLinkLabel(kind)}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}
