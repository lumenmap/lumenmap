import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cycleFocusWithinSheet,
  DETAIL_PANEL_MOBILE_BREAKPOINT_PX,
  isMobileBottomSheetViewport,
  shouldDismissBottomSheetOnSwipe,
} from "./detail-bottom-sheet";

describe("Mobile bottom-sheet DetailPanel helpers (#452)", () => {
  it("activates bottom-sheet mode below the 1280px xl breakpoint and preserves desktop side column at >=1280px", () => {
    assert.equal(DETAIL_PANEL_MOBILE_BREAKPOINT_PX, 1280);
    assert.equal(isMobileBottomSheetViewport(390), true);
    assert.equal(isMobileBottomSheetViewport(768), true);
    assert.equal(isMobileBottomSheetViewport(1279), true);
    assert.equal(isMobileBottomSheetViewport(1280), false);
    assert.equal(isMobileBottomSheetViewport(1440), false);
  });

  it("dismisses on downward swipe exceeding threshold and ignores upward or short drags", () => {
    assert.equal(shouldDismissBottomSheetOnSwipe(200, 270), true);
    assert.equal(shouldDismissBottomSheetOnSwipe(200, 230), false);
    assert.equal(shouldDismissBottomSheetOnSwipe(200, 140), false);
  });

  it("cycles focus forward and backward within the dialog focus trap", () => {
    assert.equal(cycleFocusWithinSheet(4, 3, false), 0);
    assert.equal(cycleFocusWithinSheet(4, 0, true), 3);
    assert.equal(cycleFocusWithinSheet(4, 1, false), 2);
    assert.equal(cycleFocusWithinSheet(0, 0, false), -1);
  });
});
