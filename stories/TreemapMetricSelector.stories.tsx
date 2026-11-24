import type { Meta, StoryObj } from "@storybook/react-vite";
import { TreemapMetricSelector } from "@/components/dashboard/TreemapMetricSelector";
import { emptyActivity } from "./fixtures";

const meta = {
  title: "Dashboard/TreemapMetricSelector",
  component: TreemapMetricSelector,
} satisfies Meta<typeof TreemapMetricSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const UsdcVolume: Story = {
  parameters: { dashboard: { metric: "usdc" } },
};

export const ProtocolTvl: Story = {
  parameters: { dashboard: { metric: "protocol_tvl" } },
};

/** Without data the transaction metric is disabled. */
export const Loading: Story = {
  parameters: {
    dashboard: { data: undefined, isLoading: true, metric: "ops" },
  },
};

export const Empty: Story = {
  parameters: { dashboard: { data: emptyActivity } },
};
