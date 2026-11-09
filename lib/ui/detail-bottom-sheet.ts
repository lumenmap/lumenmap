export const DETAIL_PANEL_MOBILE_BREAKPOINT_PX = 1280;
export const SWIPE_DISMISS_THRESHOLD_PX = 64;

export function isMobileBottomSheetViewport(widthPx: number): boolean {
  return Number.isFinite(widthPx) && widthPx < DETAIL_PANEL_MOBILE_BREAKPOINT_PX;
}

export function shouldDismissBottomSheetOnSwipe(
  startY: number,
  endY: number,
  thresholdPx = SWIPE_DISMISS_THRESHOLD_PX,
): boolean {
  const deltaY = endY - startY;
  return Number.isFinite(deltaY) && deltaY >= thresholdPx;
}

export function cycleFocusWithinSheet(
  focusableCount: number,
  currentIndex: number,
  shiftKey: boolean,
): number {
  if (focusableCount <= 0) return -1;
  if (shiftKey) {
    return currentIndex <= 0 ? focusableCount - 1 : currentIndex - 1;
  }
  return currentIndex >= focusableCount - 1 ? 0 : currentIndex + 1;
}
