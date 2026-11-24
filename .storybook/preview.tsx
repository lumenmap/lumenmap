import { useState } from "react";
import type { Decorator, Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockDashboardProvider } from "./mocks/DashboardProvider";
import "../app/globals.css";

const offlineFetch: typeof fetch = () =>
  Promise.reject(new Error("Network access is disabled in Storybook."));

function StoryShell({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const withDashboardContext: Decorator = (Story, { id, parameters }) => (
  <StoryShell key={id}>
    <MockDashboardProvider overrides={parameters.dashboard}>
      <div className="mx-auto w-full max-w-7xl p-4">
        <Story />
      </div>
    </MockDashboardProvider>
  </StoryShell>
);

const preview: Preview = {
  decorators: [withDashboardContext],
  // Every story runs offline unless it supplies a fixture `fetchHandler`.
  beforeEach: ({ parameters }) => {
    const originalFetch = window.fetch;
    window.fetch = parameters.fetchHandler ?? offlineFetch;
    return () => {
      window.fetch = originalFetch;
    };
  },
  parameters: {
    layout: "fullscreen",
    backgrounds: { options: { app: { name: "app", value: "#0b0e14" } } },
    controls: { disableSaveFromUI: true },
  },
  initialGlobals: { backgrounds: { value: "app" } },
};

export default preview;
