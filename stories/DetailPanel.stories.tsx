import type { Meta, StoryObj } from "@storybook/react-vite";
import { DetailPanel } from "@/components/dashboard/DetailPanel";
import {
  accountNode,
  contractNode,
  jsonResponse,
  pendingFetch,
} from "./fixtures";

const meta = {
  title: "Dashboard/DetailPanel",
  component: DetailPanel,
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Account: Story = {
  parameters: {
    dashboard: { selectedNode: accountNode },
    fetchHandler: () =>
      jsonResponse({ firstSeenAt: "2024-01-01T00:00:00.000Z", source: "fixture" }),
  },
};

export const Contract: Story = {
  parameters: {
    dashboard: { selectedNode: contractNode },
    fetchHandler: () =>
      jsonResponse({ firstSeenAt: "2025-03-10T00:00:00.000Z", source: "fixture" }),
  },
};

export const Loading: Story = {
  parameters: { dashboard: { selectedNode: accountNode, isLoading: true } },
};

export const FirstSeenLoading: Story = {
  parameters: {
    dashboard: { selectedNode: accountNode },
    fetchHandler: pendingFetch,
  },
};

export const FirstSeenError: Story = {
  parameters: {
    dashboard: { selectedNode: accountNode },
    fetchHandler: () => jsonResponse({ message: "Lookup failed" }, 500),
  },
};

export const NothingSelected: Story = {
  parameters: { dashboard: { selectedNode: null } },
};
