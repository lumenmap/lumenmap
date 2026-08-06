"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  buildExportMetadata,
  exportSvgToPng,
  exportToCsv,
  flattenTreemapForCsv,
  generateSafeFilename,
  getStructuredRowsForExport,
} from "@/lib/export-utils";
import { TREEMAP_VIEWS } from "@/lib/constants";

interface ExportControlsProps {
  svgRef?: React.RefObject<SVGSVGElement>;
}

export function ExportControls({ svgRef }: ExportControlsProps) {
  const { data, period, treemapView } = useDashboard();

  const activeView = TREEMAP_VIEWS.find((v) => v.id === treemapView);
  const viewLabel = activeView?.label || "Network Activity";

  const handleExportPng = async () => {
    try {
      let svgElement: SVGSVGElement | null = null;

      if (svgRef?.current) {
        svgElement = svgRef.current;
      } else {
        // Fallback: find the svg rendered by D3Treemap
        const container = document.querySelector(
          '[data-treemap-container="true"] svg'
        ) as SVGSVGElement | null;
        svgElement = container;
      }

      if (!svgElement) {
        // Try broader selector in case of ref issues
        const allSvgs = document.querySelectorAll("svg[role='img']");
        if (allSvgs.length > 0) {
          svgElement = allSvgs[allSvgs.length - 1] as SVGSVGElement;
        }
      }

      if (!svgElement) {
        alert("Treemap visualization not found for export.");
        return;
      }

      const metadata = buildExportMetadata(data, period, treemapView, viewLabel);
      const filename = generateSafeFilename(
        "lumenmap-treemap",
        metadata.metric,
        period,
        "png"
      );

      await exportSvgToPng(svgElement, filename, 2);
    } catch (error) {
      console.error("PNG export failed:", error);
      alert("Failed to export PNG. Please try again.");
    }
  };

  const handleExportCsv = () => {
    try {
      const metadata = buildExportMetadata(data, period, treemapView, viewLabel);
      const { rows, syntheticIdentifiers } = getStructuredRowsForExport(
        data,
        treemapView
      );

      // Also provide flattened treemap data as alternative structured view
      let csvRows = rows;
      let filenamePrefix = "lumenmap-data";

      if (data?.treemaps?.[treemapView]) {
        const flattened = flattenTreemapForCsv(data.treemaps[treemapView]);
        if (flattened.length > 0) {
          csvRows = flattened;
          filenamePrefix = "lumenmap-treemap";
        }
      }

      const filename = generateSafeFilename(
        filenamePrefix,
        metadata.metric,
        period,
        "csv"
      );

      exportToCsv(csvRows, filename, metadata, syntheticIdentifiers);
    } catch (error) {
      console.error("CSV export failed:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPng}
        className="gap-1.5 text-xs"
        title="Export current treemap visualization as PNG"
      >
        <Download className="h-3.5 w-3.5" />
        Export PNG
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCsv}
        className="gap-1.5 text-xs"
        title="Export structured data rows as CSV with metadata"
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
    </div>
  );
}
