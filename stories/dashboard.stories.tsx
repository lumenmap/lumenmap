import {
  DASHBOARD_STORY_CATALOG,
  type DashboardStoryDescriptor,
} from "@/lib/storybook/catalog";

const meta = {
  title: "Dashboard/CoreComponents",
  parameters: {
    fixtureOnly: true,
    layout: "padded",
  },
};

export default meta;

function getStory(id: string): DashboardStoryDescriptor {
  const found = DASHBOARD_STORY_CATALOG.find((story) => story.id === id);
  if (!found) {
    throw new Error(`Missing story descriptor: ${id}`);
  }
  return found;
}

export const KpiCardsLoaded = getStory("dashboard-kpicards--loaded");
export const KpiCardsLoading = getStory("dashboard-kpicards--loading");
export const KpiCardsEmptyUnavailable = getStory(
  "dashboard-kpicards--empty-unavailable",
);
export const TreemapMetricSelectorDefault = getStory(
  "dashboard-treemapmetricselector--default",
);
export const PeriodSelectorDefault = getStory(
  "dashboard-periodselector--default",
);
export const DetailPanelSelectedAccount = getStory(
  "dashboard-detailpanel--selected-account",
);
export const DetailPanelEmpty = getStory("dashboard-detailpanel--empty");
export const FlowViewLoaded = getStory("dashboard-flowview--loaded");
export const FlowViewEmpty = getStory("dashboard-flowview--empty");
export const FlowViewLoading = getStory("dashboard-flowview--loading");
export const FlowViewError = getStory("dashboard-flowview--error");
