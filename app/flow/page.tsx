// Flow page route
"use client";

import { FlowSection } from "@/components/dashboard/FlowSection";
import { SectionNav } from "@/components/dashboard/SectionNav";
import { DashboardProvider } from "@/components/dashboard/DashboardProvider";

export default function FlowPage() {
  return (
    <DashboardProvider>
      <SectionNav />
      <FlowSection />
    </DashboardProvider>
  );
}
