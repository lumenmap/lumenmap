// Treemap page route
"use client";

import { TreemapSection } from "@/components/dashboard/TreemapSection";
import { SectionNav } from "@/components/dashboard/SectionNav";
import { DashboardProvider } from "@/components/dashboard/DashboardProvider";

export default function TreemapPage() {
  return (
    <DashboardProvider>
      <SectionNav />
      <TreemapSection />
    </DashboardProvider>
  );
}
