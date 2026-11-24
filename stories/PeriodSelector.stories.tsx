import type { Meta, StoryObj } from "@storybook/react-vite";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";

const meta = {
  title: "Dashboard/PeriodSelector",
  component: PeriodSelector,
} satisfies Meta<typeof PeriodSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SevenDays: Story = {
  parameters: { dashboard: { period: "7d" } },
};

export const CustomRange: Story = {
  parameters: { dashboard: { period: "custom:2026-07-01:2026-07-15" } },
};

export const WithComparison: Story = {
  parameters: { dashboard: { period: "7d", comparePeriod: "30d" } },
};
