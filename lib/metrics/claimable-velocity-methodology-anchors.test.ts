import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS,
  claimableVelocityMethodologyHref,
} from "./claimable-velocity-methodology-anchors";
import { METHODOLOGY_SECTIONS } from "./methodology";

const ids = Object.values(CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS);
const pageSource = readFileSync(
  join(process.cwd(), "app/methodology/page.tsx"),
  "utf8",
);

describe("claimable velocity methodology anchors", () => {
  it("are unique", () => {
    assert.equal(new Set(ids).size, ids.length);
  });

  it("keep the primary id aligned with the methodology section", () => {
    assert.ok(
      METHODOLOGY_SECTIONS.some(
        (section) =>
          section.id === CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS.velocity,
      ),
    );
  });

  it("are valid fragment ids", () => {
    for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/);
  });

  it("are rendered as ids by the methodology page", () => {
    assert.match(pageSource, /CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS/);
    for (const key of Object.keys(CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS)) {
      assert.match(
        pageSource,
        new RegExp(
          `id=\\{CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS\\.${key}\\}`,
        ),
        key,
      );
    }
  });

  it("builds in-app hrefs", () => {
    assert.equal(
      claimableVelocityMethodologyHref(
        CLAIMABLE_VELOCITY_METHODOLOGY_ANCHORS.limits,
      ),
      "/methodology#claimable-velocity-limits",
    );
  });
});
