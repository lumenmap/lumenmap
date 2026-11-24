"use client";

import { useId, useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/components/dashboard/DashboardProvider";
import { copyText } from "@/lib/clipboard";
import { buildMarkdownFromActivity } from "@/lib/export-markdown";
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

type CopyMarkdownStatus = "idle" | "copied" | "failed";

export function ExportControls({ svgRef }: ExportControlsProps) {
  const { data, period, treemapView, isLoading, isFetching } = useDashboard();
  const [exportAsLight, setExportAsLight] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyMarkdownStatus>("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightToggleId = useId();
  const copyStatusId = useId();

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

      await exportSvgToPng(svgElement, filename, 2, exportAsLight ? "light" : "dark");
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

      if (treemapView !== "flow" && data?.treemaps?.[treemapView as "events" | "actors"]) {
        const flattened = flattenTreemapForCsv(data.treemaps[treemapView as "events" | "actors"]);
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

  const handleCopyMarkdown = async () => {
    if (isLoading || isFetching || !data?.kpis) {
      setCopyStatus("failed");
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopyStatus("idle"), 4000);
      return;
    }

    const permalink =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}${window.location.search}`
        : "";

    const markdown = buildMarkdownFromActivity(data, permalink);
    const result = await copyText(markdown);

    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    if (result.ok) {
      setCopyStatus("copied");
      copyResetTimer.current = setTimeout(() => setCopyStatus("idle"), 2000);
      return;
    }
    setCopyStatus("failed");
    copyResetTimer.current = setTimeout(() => setCopyStatus("idle"), 4000);
  };

  const copyToast =
    copyStatus === "copied"
      ? "Markdown snapshot copied to clipboard"
      : copyStatus === "failed"
        ? "Could not copy Markdown. Try again or select text manually."
        : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={lightToggleId}
        className="flex items-center gap-1.5 text-xs text-zinc-400"
        title="Render the PNG export on a light background instead of the app's dark theme. The app itself stays dark; only the exported file changes."
      >
        <input
          id={lightToggleId}
          type="checkbox"
          checked={exportAsLight}
          onChange={(e) => setExportAsLight(e.target.checked)}
          className="h-3.5 w-3.5 accent-[#5f4ae0]"
        />
        Export as light
      </label>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPng}
        className="gap-1.5 text-xs"
        title={`Export current treemap visualization as PNG (${exportAsLight ? "light" : "dark"} background)`}
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
        title="Export KPI row, chart title, and freshness as PDF (already a light/white page — the light toggle above only affects PNG)"
      >
        <Download className="h-3.5 w-3.5" />
        Export PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void handleCopyMarkdown();
        }}
        disabled={isLoading || isFetching || !data?.kpis}
        className="gap-1.5 text-xs"
        title="Copy a Markdown summary of period, KPIs, top categories, and protocols"
        aria-label="Copy dashboard snapshot as Markdown"
        aria-describedby={copyStatusId}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        Copy Markdown
      </Button>
      <p
        id={copyStatusId}
        role="status"
        aria-live="polite"
        className={
          copyStatus === "idle"
            ? "sr-only"
            : copyStatus === "copied"
              ? "text-xs text-emerald-400"
              : "text-xs text-amber-300"
        }
      >
        {copyStatus === "idle"
          ? "Copies a Markdown snapshot for issue and grant reports"
          : copyToast}
      </p>
    </div>
  );
}
