import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { getByText } from "@testing-library/dom";
import { Card, CardTitle } from "./card";

describe("Card", () => {
  it("renders a card with semantic surface and border classes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <Card>
            <CardTitle>Title</CardTitle>
          </Card>,
        );
      });

      const title = getByText(container, "Title");

      expect(title.className).toContain("text-text-secondary");
      expect(title.closest("div")?.className).toContain("bg-surface");
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  });
});
