import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AssetLeaderboardTable } from "./AssetLeaderboard";
import { ASSET_LEADERBOARD_FIXTURE } from "@/lib/assets/leaderboard-fixture";
import { rankAssetVolumes } from "@/lib/assets/leaderboard";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test("renders the eight-asset fixture and can sort by code", () => {
  const result = rankAssetVolumes(ASSET_LEADERBOARD_FIXTURE);
  act(() => {
    root.render(<AssetLeaderboardTable result={result} />);
  });
  expect(container.textContent).toContain("XLM");
  expect(container.textContent).toContain("yXLM");
  expect(container.textContent).toContain("1 row omitted");
  const code = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Code");
  act(() => {
    code?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(container.querySelector("th[aria-sort='ascending']")?.textContent).toContain("Code");
});
