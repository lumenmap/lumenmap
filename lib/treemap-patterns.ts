import { CATEGORY_PATTERNS } from "@/lib/constants";

/** Opacity of the pattern overlay rect — low enough not to obscure tile labels */
export const PATTERN_OPACITY = 0.18;

/** Describes a single SVG <line> element within a pattern tile */
interface LineSpec {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

/** Describes a single SVG <circle> element within a pattern tile */
interface CircleSpec {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

type ShapeSpec = LineSpec | CircleSpec;

/** Pure-data description of an SVG <pattern> element */
export interface PatternDef {
  /** Stable id referenced by fill="url(#...)" on overlay rects */
  id: string;
  width: number;
  height: number;
  /** Optional SVG transform on the <pattern> element (e.g. rotate for diagonal) */
  patternTransform?: string;
  shapes: ShapeSpec[];
}

/**
 * All category pattern definitions as plain data — no JSX.
 * Render via renderPatternDefs() in SVG <defs>.
 */
export const PATTERN_DEFS: PatternDef[] = [
  {
    id: "lm-pattern-diagonal",
    width: 6,
    height: 6,
    patternTransform: "rotate(45)",
    shapes: [
      { type: "line", x1: 0, y1: 0, x2: 0, y2: 6, stroke: "white", strokeWidth: 1.5 },
    ],
  },
  {
    id: "lm-pattern-horizontal",
    width: 4,
    height: 4,
    shapes: [
      { type: "line", x1: 0, y1: 2, x2: 4, y2: 2, stroke: "white", strokeWidth: 1 },
    ],
  },
  {
    id: "lm-pattern-crosshatch",
    width: 8,
    height: 8,
    shapes: [
      { type: "line", x1: 0, y1: 0, x2: 8, y2: 8, stroke: "white", strokeWidth: 1 },
      { type: "line", x1: 8, y1: 0, x2: 0, y2: 8, stroke: "white", strokeWidth: 1 },
    ],
  },
  {
    id: "lm-pattern-dots",
    width: 5,
    height: 5,
    shapes: [
      { type: "circle", cx: 2.5, cy: 2.5, r: 1, fill: "white" },
    ],
  },
  {
    id: "lm-pattern-vertical",
    width: 5,
    height: 5,
    shapes: [
      { type: "line", x1: 2.5, y1: 0, x2: 2.5, y2: 5, stroke: "white", strokeWidth: 1.5 },
    ],
  },
  {
    id: "lm-pattern-grid",
    width: 6,
    height: 6,
    shapes: [
      { type: "line", x1: 0, y1: 3, x2: 6, y2: 3, stroke: "white", strokeWidth: 1 },
      { type: "line", x1: 3, y1: 0, x2: 3, y2: 6, stroke: "white", strokeWidth: 1 },
    ],
  },
  {
    id: "lm-pattern-diamond",
    width: 8,
    height: 8,
    patternTransform: "rotate(45)",
    shapes: [
      { type: "line", x1: 0, y1: 0, x2: 8, y2: 8, stroke: "white", strokeWidth: 1 },
      { type: "line", x1: 8, y1: 0, x2: 0, y2: 8, stroke: "white", strokeWidth: 1 },
    ],
  },
];

/** Map from pattern variant name → pattern def id */
const VARIANT_TO_ID: Record<string, string> = {
  diagonal: "lm-pattern-diagonal",
  horizontal: "lm-pattern-horizontal",
  crosshatch: "lm-pattern-crosshatch",
  dots: "lm-pattern-dots",
  vertical: "lm-pattern-vertical",
  grid: "lm-pattern-grid",
  diamond: "lm-pattern-diamond",
};

/**
 * Returns the SVG pattern id for a category key, or null for
 * categories with no pattern (i.e. "other" or unknown).
 */
export function getCategoryPatternId(category?: string): string | null {
  if (!category) return null;
  const variant = CATEGORY_PATTERNS[category];
  if (!variant || variant === "none") return null;
  return VARIANT_TO_ID[variant] ?? null;
}
