export type StoryStateKind = "loaded" | "loading" | "empty" | "error";

export interface DashboardStoryDescriptor {
  id: string;
  component:
    | "KpiCards"
    | "TreemapMetricSelector"
    | "PeriodSelector"
    | "DetailPanel"
    | "FlowView";
  title: string;
  state: StoryStateKind;
  fixtureOnly: true;
  description: string;
  args: Record<string, unknown>;
}

export const DASHBOARD_STORY_CATALOG: readonly DashboardStoryDescriptor[] = [
  {
    id: "dashboard-kpicards--loaded",
    component: "KpiCards",
    title: "Dashboard/KpiCards/Loaded",
    state: "loaded",
    fixtureOnly: true,
    description:
      "Renders KPI strip with deterministic fixture totals and sparkline buckets.",
    args: {
      isLoading: false,
      totalOps: 4_820_150,
      sorobanShare: 38.4,
      topCategory: "defi",
      activeContracts: 1_240,
      activeWallets: 84_500,
      activeDestinationAccounts: 61_200,
    },
  },
  {
    id: "dashboard-kpicards--loading",
    component: "KpiCards",
    title: "Dashboard/KpiCards/Loading",
    state: "loading",
    fixtureOnly: true,
    description: "Renders KPI skeleton placeholders while fixture query loads.",
    args: {
      isLoading: true,
    },
  },
  {
    id: "dashboard-kpicards--empty-unavailable",
    component: "KpiCards",
    title: "Dashboard/KpiCards/EmptyUnavailable",
    state: "empty",
    fixtureOnly: true,
    description:
      "Renders Unavailable badges when optional KPI values are null or omitted.",
    args: {
      isLoading: false,
      totalOps: 0,
      sorobanShare: 0,
      topCategory: "other",
      activeContracts: null,
      activeWallets: null,
      activeDestinationAccounts: null,
    },
  },
  {
    id: "dashboard-treemapmetricselector--default",
    component: "TreemapMetricSelector",
    title: "Dashboard/TreemapMetricSelector/Default",
    state: "loaded",
    fixtureOnly: true,
    description:
      "Accessible toggle group for Operation Count, XLM Volume, USDC Volume, and Protocol TVL.",
    args: {
      metric: "ops",
    },
  },
  {
    id: "dashboard-periodselector--default",
    component: "PeriodSelector",
    title: "Dashboard/PeriodSelector/Default",
    state: "loaded",
    fixtureOnly: true,
    description:
      "Keyboard-roving radio group for 1d, 7d, 30d, and month periods with comparison selector.",
    args: {
      period: "7d",
      comparePeriod: null,
    },
  },
  {
    id: "dashboard-detailpanel--selected-account",
    component: "DetailPanel",
    title: "Dashboard/DetailPanel/SelectedAccount",
    state: "loaded",
    fixtureOnly: true,
    description:
      "Displays selected Stellar account metadata, fixture first-seen timestamp, and Explorer link.",
    args: {
      nodeName: "Soroswap Router",
      nodeType: "account",
      nodeId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      value: 125_400,
      share: 0.142,
      firstSeenAt: "2024-01-01T00:00:00.000Z",
    },
  },
  {
    id: "dashboard-detailpanel--empty",
    component: "DetailPanel",
    title: "Dashboard/DetailPanel/Empty",
    state: "empty",
    fixtureOnly: true,
    description:
      "Empty prompt when no treemap tile or flow entity is currently selected.",
    args: {
      selectedNode: null,
    },
  },
  {
    id: "dashboard-flowview--loaded",
    component: "FlowView",
    title: "Dashboard/FlowView/Loaded",
    state: "loaded",
    fixtureOnly: true,
    description:
      "Payment Flow canvas and data table populated from deterministic fixture edges.",
    args: {
      fixture: true,
      edgeCount: 12,
    },
  },
  {
    id: "dashboard-flowview--empty",
    component: "FlowView",
    title: "Dashboard/FlowView/Empty",
    state: "empty",
    fixtureOnly: true,
    description:
      "Empty FlowView state with zero edges and disabled CSV export button.",
    args: {
      fixture: false,
      edges: [],
      nodes: [],
    },
  },
  {
    id: "dashboard-flowview--loading",
    component: "FlowView",
    title: "Dashboard/FlowView/Loading",
    state: "loading",
    fixtureOnly: true,
    description:
      "Loading skeleton state for FlowView before fixture graph edges resolve.",
    args: {
      fixture: true,
      isLoading: true,
    },
  },
  {
    id: "dashboard-flowview--error",
    component: "FlowView",
    title: "Dashboard/FlowView/Error",
    state: "error",
    fixtureOnly: true,
    description:
      "Error state when payment flow query fails and surfaces fixture fallback guidance.",
    args: {
      fixture: false,
      error: "Fixture simulated payment-flow query failure",
    },
  },
];

export function validateStoryCatalog(
  stories: readonly DashboardStoryDescriptor[] = DASHBOARD_STORY_CATALOG,
): {
  valid: boolean;
  storyCount: number;
  coveredComponents: string[];
  coveredStates: StoryStateKind[];
} {
  const requiredComponents = [
    "KpiCards",
    "TreemapMetricSelector",
    "PeriodSelector",
    "DetailPanel",
    "FlowView",
  ];
  const requiredStates: StoryStateKind[] = [
    "loaded",
    "loading",
    "empty",
    "error",
  ];

  const coveredComponents = Array.from(
    new Set(stories.map((story) => story.component)),
  );
  const coveredStates = Array.from(
    new Set(stories.map((story) => story.state)),
  );
  const allFixtureOnly = stories.every((story) => story.fixtureOnly === true);
  const hasAllComponents = requiredComponents.every((component) =>
    coveredComponents.includes(component as DashboardStoryDescriptor["component"]),
  );
  const hasAllStates = requiredStates.every((state) =>
    coveredStates.includes(state),
  );

  return {
    valid:
      stories.length >= 6 &&
      allFixtureOnly &&
      hasAllComponents &&
      hasAllStates,
    storyCount: stories.length,
    coveredComponents,
    coveredStates,
  };
}
