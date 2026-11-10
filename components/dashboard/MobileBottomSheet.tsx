"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  isEscapeDismissKey,
  isMobileDetailSheetViewport,
  resolveFocusTrapTarget,
  shouldDismissOnSwipe,
} from "@/lib/ui/mobile-bottom-sheet";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ResponsiveDetailPanelContainer({
  label,
  onDismiss,
  children,
}: {
  label: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateViewport = () => {
      setIsMobile(isMobileDetailSheetViewport(window.innerWidth));
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const sheet = sheetRef.current;
    const focusables = sheet
      ? Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    focusables[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEscapeDismissKey(event.key)) {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key === "Tab" && sheet) {
        const nodes = Array.from(
          sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        const activeIndex = nodes.indexOf(
          document.activeElement as HTMLElement,
        );
        const nextIndex = resolveFocusTrapTarget({
          key: event.key,
          shiftKey: event.shiftKey,
          activeIndex,
          count: nodes.length,
        });
        if (nextIndex !== null && nodes[nextIndex]) {
          event.preventDefault();
          nodes[nextIndex].focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, onDismiss]);

  if (!isMobile) {
    return (
      <div className="min-w-0 scroll-mt-4" id="detail-panel-container">
        {children}
      </div>
    );
  }

  return (
    <div
      id="detail-panel-container"
      data-testid="mobile-detail-bottom-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${label}`}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs motion-reduce:transition-none xl:hidden"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        ref={sheetRef}
        className="max-h-[85vh] w-full max-w-full overflow-x-hidden overflow-y-auto rounded-t-2xl border-t border-white/15 bg-zinc-950 p-3 shadow-2xl transition-transform duration-200 motion-reduce:transition-none"
        onTouchStart={(event) => {
          touchStartYRef.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const startY = touchStartYRef.current;
          const endY = event.changedTouches[0]?.clientY ?? null;
          touchStartYRef.current = null;
          if (
            startY !== null &&
            endY !== null &&
            shouldDismissOnSwipe(startY, endY)
          ) {
            onDismiss();
          }
        }}
      >
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            data-testid="detail-sheet-drag-handle"
            aria-label="Dismiss detail sheet"
            onClick={onDismiss}
            className="h-1.5 w-12 rounded-full bg-white/25 hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
