"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import {
  buildDashboardPdfDocument,
  buildExportMetadata,
  downloadBlob,
  exportSvgToPng,
  exportToCsv,
  flattenTreemapForCsv,
  generateSafeFilename,
  getStructuredRowsForExport,
  prefersReducedMotion,
} from "@/lib/export-utils";
import { TREEMAP_VIEWS } from "@/lib/constants";

interface ExportControlsProps {
  svgRef?: React.RefObject<SVGSVGElement>;
}

export function ExportControls({ svgRef }: ExportControlsProps) {
  const { data, period, treemapView, isLoading, isFetching } = useDashboard();

  const activeView = TREEMAP_VIEWS.find((v) => v.id === treemapView);
  const viewLabel = activeView?.label || "Network Activity";

  const handleExportPng = async () => {
    try {
      let svgElement: SVGSVGElement | null = null;

      if (svgRef?.current) {
        svgElement = svgRef.current;
      } else {
        const container = document.querySelector(
          '[data-treemap-container="true"] svg',
        ) as SVGSVGElement | null;
        svgElement = container;
      }

      if (!svgElement) {
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
        "png",
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
        treemapView,
      );

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
        "csv",
      );

      exportToCsv(csvRows, filename, metadata, syntheticIdentifiers);
    } catch (error) {
      console.error("CSV export failed:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const handleExportPdf = () => {
    try {
      if (isLoading || isFetching || !data) {
        alert("Charts are still loading. Wait for data before exporting PDF.");
        return;
      }

      if (prefersReducedMotion()) {
        document.documentElement.dataset.pdfExport = "reduced-motion";
      }

      const metadata = buildExportMetadata(data, period, treemapView, viewLabel);
      const kpis = data.kpis as unknown as Record<string, unknown>;
      const kpiLines = Object.entries(kpis)
        .filter(([, value]) => typeof value === "number" || typeof value === "string")
        .slice(0, 8)
        .map(([key, value]) => `${key}: ${String(value)}`);

      if (kpiLines.length === 0) {
        kpiLines.push("KPI values unavailable");
      }

      const blob = buildDashboardPdfDocument({
        metadata,
        kpiLines,
        chartTitle: viewLabel,
        loading: false,
      });
      const filename = generateSafeFilename(
        "lumenmap-dashboard",
        metadata.metric,
        period,
        "pdf",
      );
      downloadBlob(blob, filename);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to export PDF. Please try again.",
      );
    } finally {
      delete document.documentElement.dataset.pdfExport;
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPdf}
        className="gap-1.5 text-xs"
        title="Export KPI row, chart title, and freshness as PDF"
      >
        <Download className="h-3.5 w-3.5" />
        Export PDF
      </Button>
    </div>
  );
}
