/**
 * Mobile bottom-sheet helpers for `DetailPanel` (issue #452).
 *
 * Below `DETAIL_PANEL_MOBILE_BREAKPOINT_PX` (1280px, Tailwind `xl`), the
 * detail panel renders as a modal bottom sheet with focus trapping, Escape
 * key dismissal, and downward touch-swipe dismissal. At or above 1280px, the
 * desktop side column layout is preserved.
 */

export const DETAIL_PANEL_MOBILE_BREAKPOINT_PX = 1280;
export const SWIPE_DISMISS_THRESHOLD_PX = 72;

export function isMobileDetailSheetViewport(widthPx: number): boolean {
  return Number.isFinite(widthPx) && widthPx > 0 && widthPx < DETAIL_PANEL_MOBILE_BREAKPOINT_PX;
}

export function isEscapeDismissKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}

export function shouldDismissOnSwipe(
  startY: number,
  endY: number,
  thresholdPx: number = SWIPE_DISMISS_THRESHOLD_PX,
): boolean {
  if (!Number.isFinite(startY) || !Number.isFinite(endY)) return false;
  return endY - startY >= thresholdPx;
}

/**
 * Computes the next focusable element index when trapping Tab / Shift+Tab
 * inside the bottom sheet. Returns null when the key is not Tab or there are
 * no focusable elements.
 */
export function resolveFocusTrapTarget(input: {
  key: string;
  shiftKey: boolean;
  activeIndex: number;
  count: number;
}): number | null {
  if (input.key !== "Tab" || input.count <= 0) {
    return null;
  }
  if (input.shiftKey) {
    if (input.activeIndex <= 0) {
      return input.count - 1;
    }
    return input.activeIndex - 1;
  }
  if (input.activeIndex < 0 || input.activeIndex >= input.count - 1) {
    return 0;
  }
  return input.activeIndex + 1;
}
