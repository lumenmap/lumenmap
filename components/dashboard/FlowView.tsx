"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FLOW_FIXTURE } from "@/lib/fixtures/flow";
import { FlowCanvas } from "./FlowCanvas";
import { FlowDataTable, FlowViewToggle, type FlowView as FlowDisplay } from "./FlowDataTable";

export function FlowView({ fixture }: { fixture: boolean }) {
  const [display, setDisplay] = useState<FlowDisplay>("graph");
  return (
    <Card data-testid="flow-view" className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Payment Flow</CardTitle>
          <p className="mt-1 text-xs text-zinc-400">
            {fixture
              ? "Directed account connections · illustrative fixture sample (same for each period)"
              : "Directed account connections"}
          </p>
        </div>
        {fixture && <FlowViewToggle view={display} onChange={setDisplay} />}
      </CardHeader>
      <CardContent className="min-w-0">
        {!fixture ? (
          <p role="status" className="py-16 text-center text-sm text-zinc-400">
            Flow graph data is available in fixture mode only.
          </p>
        ) : display === "graph" ? (
          <FlowCanvas nodes={FLOW_FIXTURE.nodes} edges={FLOW_FIXTURE.edges} />
        ) : (
          <FlowDataTable nodes={FLOW_FIXTURE.nodes} edges={FLOW_FIXTURE.edges} showNodes />
        )}
      </CardContent>
    </Card>
  );
}
