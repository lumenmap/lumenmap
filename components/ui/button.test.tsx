import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { getByRole } from "@testing-library/dom";
import { Button } from "./button";

describe("Button", () => {
  it("renders the default button variant with semantic token classes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<Button>Action</Button>);
      });

      const button = getByRole(container, "button", { name: "Action" });

      expect(button.className).toContain("bg-surface-accent");
      expect(button.className).toContain("text-foreground");
      expect(button.className).toContain("hover:bg-surface-accent-hover");
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  });
});
