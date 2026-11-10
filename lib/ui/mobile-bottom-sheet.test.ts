import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DETAIL_PANEL_MOBILE_BREAKPOINT_PX,
  isEscapeDismissKey,
  isMobileDetailSheetViewport,
  resolveFocusTrapTarget,
  shouldDismissOnSwipe,
} from "@/lib/ui/mobile-bottom-sheet";

describe("Mobile bottom-sheet DetailPanel helpers (#452)", () => {
  it("activates bottom-sheet mode below 1280px (including 390px mobile) and preserves desktop column at >=1280px", () => {
    assert.equal(DETAIL_PANEL_MOBILE_BREAKPOINT_PX, 1280);
    assert.equal(isMobileDetailSheetViewport(390), true);
    assert.equal(isMobileDetailSheetViewport(768), true);
    assert.equal(isMobileDetailSheetViewport(1279), true);
    assert.equal(isMobileDetailSheetViewport(1280), false);
    assert.equal(isMobileDetailSheetViewport(1440), false);
  });

  it("detects Escape key dismissal", () => {
    assert.equal(isEscapeDismissKey("Escape"), true);
    assert.equal(isEscapeDismissKey("Esc"), true);
    assert.equal(isEscapeDismissKey("Enter"), false);
  });

  it("dismisses on downward swipe exceeding threshold and ignores upward or short swipes", () => {
    assert.equal(shouldDismissOnSwipe(200, 280), true);
    assert.equal(shouldDismissOnSwipe(200, 240), false);
    assert.equal(shouldDismissOnSwipe(280, 180), false);
  });

  it("wraps Tab and Shift+Tab focus indices within the sheet", () => {
    assert.equal(
      resolveFocusTrapTarget({
        key: "Tab",
        shiftKey: false,
        activeIndex: 2,
        count: 3,
      }),
      0,
    );
    assert.equal(
      resolveFocusTrapTarget({
        key: "Tab",
        shiftKey: true,
        activeIndex: 0,
        count: 3,
      }),
      2,
    );
    assert.equal(
      resolveFocusTrapTarget({
        key: "Enter",
        shiftKey: false,
        activeIndex: 0,
        count: 3,
      }),
      null,
    );
  });
});
