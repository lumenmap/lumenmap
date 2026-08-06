"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText, isEligibleAddress } from "@/lib/clipboard";
import { cn, truncateAddress } from "@/lib/utils";

type CopyStatus = "idle" | "copied" | "failed";

interface CopyableAddressProps {
  address: string;
  type?: string;
  className?: string;
}

export function CopyableAddress({
  address,
  type,
  className,
}: CopyableAddressProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusId = useId();
  const eligible = isEligibleAddress(address, type);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  if (!eligible) {
    return (
      <p className={cn("break-all font-mono text-xs text-zinc-300", className)}>
        {address}
      </p>
    );
  }

  const displayAddress =
    status === "failed" ? address : truncateAddress(address, 6);

  async function handleCopy() {
    const result = await copyText(address);

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }

    if (result.ok) {
      setStatus("copied");
      resetTimer.current = setTimeout(() => setStatus("idle"), 2000);
      return;
    }

    setStatus("failed");
    resetTimer.current = setTimeout(() => setStatus("idle"), 4000);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-start gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 select-text break-all font-mono text-xs text-zinc-300",
          )}
          title={address}
          data-canonical-address={address}
        >
          {displayAddress}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 px-2"
          onClick={() => {
            void handleCopy();
          }}
          aria-label={`Copy address ${address}`}
          aria-describedby={statusId}
        >
          {status === "copied" ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="sr-only">
            {status === "copied" ? "Copied" : "Copy"}
          </span>
        </Button>
      </div>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className={cn(
          "text-xs",
          status === "idle" && "sr-only",
          status === "copied" && "text-emerald-400",
          status === "failed" && "text-amber-300",
        )}
      >
        {status === "idle"
          ? "Copies the full address"
          : status === "copied"
            ? "Address copied to clipboard"
            : "Copy failed. The full address is selectable."}
      </p>
    </div>
  );
}
