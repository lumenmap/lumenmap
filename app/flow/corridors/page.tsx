// Remittance corridors page route
"use client";

import { SectionNav } from "@/components/dashboard/SectionNav";
import { CorridorPanel } from "@/components/dashboard/CorridorPanel";
import { DashboardProvider } from "@/components/dashboard/DashboardProvider";

export default function CorridorsPage() {
  return (
    <DashboardProvider>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8">
        <SectionNav />
        <CorridorPanel />
      </div>
    </DashboardProvider>
  );
}
