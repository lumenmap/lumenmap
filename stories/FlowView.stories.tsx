import type { Meta, StoryObj } from "@storybook/react-vite";
import { FlowView } from "@/components/dashboard/FlowView";
import { FlowViewSection } from "@/components/dashboard/FlowViewSection";
import { emptyActivity, flowActivity, flowResponse, jsonResponse, pendingFetch } from "./fixtures";

const meta = {
  title: "Dashboard/FlowView",
  component: FlowView,
} satisfies Meta<typeof FlowView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Treemap-derived flow graph, rendered from the mocked dashboard context. */
export const Graph: Story = {
  parameters: { dashboard: { data: flowActivity, flowMode: "graph" } },
};

export const Table: Story = {
  parameters: { dashboard: { data: flowActivity, flowMode: "table" } },
};

export const Empty: Story = {
  parameters: { dashboard: { data: emptyActivity } },
};

type SectionStory = StoryObj<typeof FlowViewSection>;

export const SectionLoading: SectionStory = {
  render: () => <FlowViewSection />,
  parameters: { fetchHandler: pendingFetch },
};

export const SectionError: SectionStory = {
  render: () => <FlowViewSection />,
  parameters: {
    fetchHandler: () => jsonResponse({ message: "Flow unavailable" }, 500),
  },
};

export const SectionEmpty: SectionStory = {
  render: () => <FlowViewSection nodes={[]} edges={[]} />,
};

export const SectionPopulated: SectionStory = {
  render: () => <FlowViewSection />,
  parameters: { fetchHandler: () => jsonResponse(flowResponse) },
};
