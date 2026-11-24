import type { Meta, StoryObj } from "@storybook/react-vite";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { getMockLoadedActivity } from "@/lib/hubble/fixtures";
import { emptyActivity } from "./fixtures";

const meta = {
  title: "Dashboard/KpiCards",
  component: KpiCards,
} satisfies Meta<typeof KpiCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    dashboard: {
      data: {
        ...getMockLoadedActivity(),
        sourceTimestamp: new Date().toISOString(),
      },
    },
  },
};

export const Loading: Story = {
  parameters: { dashboard: { data: undefined, isLoading: true } },
};

export const Empty: Story = {
  parameters: { dashboard: { data: emptyActivity } },
};

export const Error: Story = {
  parameters: {
    dashboard: {
      data: undefined,
      isError: true,
      error: new globalThis.Error("Hubble request failed"),
    },
  },
};

export const Stale: Story = {
  parameters: {
    dashboard: {
      data: {
        ...getMockLoadedActivity(),
        sourceTimestamp: "2026-01-01T00:00:00Z",
      },
    },
  },
};
