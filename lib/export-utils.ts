import type { ActivityVisualizationResponse, Period, TreemapNode } from "@/lib/types";
import type { TreemapViewId } from "@/lib/constants";

export interface ExportMetadata {
  metric: string;
  unit: string;
  period: Period;
  timezone: string;
  freshness: string;
  filters: Record<string, string>;
  generatedAt: string;
  view: TreemapViewId;
}

export function generateSafeFilename(
  prefix: string,
  metric: string,
  period: Period,
  extension: string,
  timestamp?: string
): string {
  const safeMetric = metric.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const safePeriod = period.replace(/[^a-z0-9]/g, "");
  const datePart = timestamp || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${safeMetric}-${safePeriod}-${datePart}.${extension}`;
}

export function buildExportMetadata(
  data: ActivityVisualizationResponse | undefined,
  period: Period,
  treemapView: TreemapViewId,
  viewLabel: string
): ExportMetadata {
  const now = new Date();
  const freshness = data?.end ? new Date(data.end).toISOString() : now.toISOString();

  return {
    metric: viewLabel || "Network Activity",
    unit: "operations",
    period,
    timezone: "UTC",
    freshness,
    filters: {
      period,
      view: treemapView,
      source: data?.source || "hubble",
    },
    generatedAt: now.toISOString(),
    view: treemapView,
  };
}

export function exportSvgToPng(
  svgElement: SVGSVGElement,
  filename: string,
  scale: number = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);

      // Ensure proper namespace and dimensions for export
      if (!svgString.includes("xmlns=")) {
        svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const width = svgElement.width.baseVal.value || 800;
      const height = svgElement.height.baseVal.value || 600;

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(width * scale);
      canvas.height = Math.floor(height * scale);
      const ctx = canvas.getContext("2d", { alpha: true });

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // White background for readability
      ctx.fillStyle = "#0B0E14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to generate PNG blob"));
            return;
          }
          const link = document.createElement("a");
          link.download = filename;
          link.href = URL.createObjectURL(blob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          resolve();
        }, "image/png");
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG for PNG export"));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

export function exportToCsv(
  rows: Record<string, unknown>[],
  filename: string,
  metadata: ExportMetadata,
  syntheticRows?: string[]
): void {
  if (!rows || rows.length === 0) {
    console.warn("No rows to export");
    return;
  }

  const headers = Object.keys(rows[0]);

  // Metadata as CSV comments
  const metaLines = [
    `# LumenMap Export`,
    `# Metric: ${metadata.metric}`,
    `# Unit: ${metadata.unit}`,
    `# Period: ${metadata.period}`,
    `# Timezone: ${metadata.timezone}`,
    `# Freshness: ${metadata.freshness}`,
    `# Generated: ${metadata.generatedAt}`,
    `# Filters: ${Object.entries(metadata.filters).map(([k, v]) => `${k}=${v}`).join(", ")}`,
    `# View: ${metadata.view}`,
    `# Synthetic remainder rows identified: ${syntheticRows ? syntheticRows.join(", ") : "other"}`,
    "",
  ];

  const csvContent = [
    ...metaLines,
    headers.join(","),
    ...rows.map((row) => {
      const values = headers.map((header) => {
        let val = row[header];
        if (val === null || val === undefined) val = "";
        const str = String(val).replace(/"/g, '""');
        // Identify synthetic rows (e.g., "other" category or remainder)
        if (syntheticRows && syntheticRows.some(s => String(val).toLowerCase().includes(s.toLowerCase()))) {
          return `"${str} [synthetic]"`;
        }
        return `"${str}"`;
      });
      return values.join(",");
    }),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function flattenTreemapForCsv(node: TreemapNode & { children?: TreemapNode[] }, path: string[] = []): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const currentPath = [...path, node.name];

  const row: Record<string, unknown> = {
    path: currentPath.join(" > "),
    name: node.name,
    value: node.value ?? node.meta?.opCount ?? 0,
    share: node.meta?.share ?? null,
    category: node.meta?.category ?? null,
    type: node.meta?.type ?? null,
    id: node.meta?.id ?? node.id ?? null,
    protocol: node.meta?.protocol ?? null,
    eventType: node.meta?.eventType ?? null,
    childCount: node.meta?.childCount ?? (node.children?.length ?? 0),
    is_synthetic: node.name.toLowerCase().includes("other") || node.name.toLowerCase().includes("remainder") ? "yes" : "no",
  };

  result.push(row);

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(...flattenTreemapForCsv(child, currentPath));
    }
  }

  return result;
}

export function getStructuredRowsForExport(
  data: ActivityVisualizationResponse | undefined,
  treemapView: TreemapViewId
): { rows: Record<string, unknown>[]; syntheticIdentifiers: string[] } {
  const syntheticIdentifiers = ["other", "remainder"];
  if (!data?.treemaps?.[treemapView]) {
    return { rows: [], syntheticIdentifiers };
  }
  const rows = flattenTreemapForCsv(data.treemaps[treemapView]).map((row) => ({
    ...row,
    is_synthetic:
      String(row.name ?? "").toLowerCase().includes("other") ||
      String(row.path ?? "").toLowerCase().includes("other")
        ? "yes"
        : "no",
  }));
  return { rows, syntheticIdentifiers };
}
