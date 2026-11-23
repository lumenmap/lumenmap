"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type TouchEvent } from "react";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

// Tailwind's xl breakpoint is 1280px, matching the desktop detail column.
const MOBILE_QUERY = "(max-width: 1279px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CLOSE_MS = 180;

function subscribeToViewport(callback: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isMobileViewport() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function DetailPanelContainer() {
  const { selectedNode, setSelectedNode } = useDashboard();
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);

  const close = useCallback(() => {
    if (closeTimer.current) return;
    if (!isMobile || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSelectedNode(null);
      return;
    }
    setClosing(true);
    closeTimer.current = setTimeout(() => setSelectedNode(null), CLOSE_MS);
  }, [isMobile, setSelectedNode]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const sheet = sheetRef.current;
    const nodeId = selectedNode?.meta?.nodeId;
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      const active = document.activeElement;
      if (active === document.body || active === document.documentElement || sheet?.contains(active)) {
        if (previous?.isConnected) previous.focus();
        else if (nodeId) document.getElementById(`node-${nodeId}`)?.focus();
      }
    };
    // Capture the trigger once; selecting another node while open should not change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusables = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        event.preventDefault();
        sheet.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const index = focusables.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === focusables.length - 1)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, close]);

  function onTouchStart(event: TouchEvent<HTMLButtonElement>) {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }

  function onTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    const endY = event.changedTouches[0]?.clientY;
    if (touchStartY.current !== null && endY !== undefined && endY - touchStartY.current > 60) close();
    touchStartY.current = null;
  }

  if (!selectedNode) return null;

  return (
    <div className="min-w-0 scroll-mt-4" id="detail-panel-container">
      <div
        data-testid="detail-backdrop"
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/70 xl:hidden ${closing ? "detail-backdrop-out" : "detail-backdrop-in"}`}
      />
      <div
        ref={sheetRef}
        data-testid="detail-sheet"
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile ? "true" : undefined}
        aria-label={isMobile ? `Details: ${selectedNode.name}` : undefined}
        aria-describedby={isMobile ? "detail-sheet-hint" : undefined}
        tabIndex={isMobile ? -1 : undefined}
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-2xl border-t border-white/20 bg-[#10131a] pb-[env(safe-area-inset-bottom)] shadow-2xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-none xl:border-0 xl:bg-transparent xl:pb-0 xl:shadow-none ${closing ? "detail-sheet-out" : "detail-sheet-in"}`}
      >
        <p id="detail-sheet-hint" className="sr-only xl:hidden">Swipe down on the handle, press Escape, or use Close details to dismiss.</p>
        <button
          type="button"
          aria-label="Dismiss details"
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="flex h-11 w-full items-center justify-center xl:hidden"
        >
          <span className="h-1.5 w-12 rounded-full bg-zinc-500" />
        </button>
        <DetailPanel onClose={close} />
      </div>
    </div>
  );
}
