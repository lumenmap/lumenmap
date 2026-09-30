import { z } from "zod";

import { PERIODS } from "@/lib/types";

export const flowPeriodSchema = z.enum(PERIODS);

export const flowQuerySchema = z.object({
  period: flowPeriodSchema.default("1d"),
  account: z
    .string()
    .trim()
    .min(1)
    .max(56)
    .regex(/^G[A-Z0-9]{55}$/, "Invalid Stellar account identifier.")
    .optional(),
});

export type FlowQuery = z.infer<typeof flowQuerySchema>;

export const flowGraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["account", "contract", "asset", "other"]),
  opCount: z.number().nonnegative(),
  xlmVolume: z.number().nonnegative(),
});

export const flowGraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  opCount: z.number().nonnegative(),
  xlmVolume: z.number().nonnegative(),
});

export const flowGraphSchema = z.object({
  period: flowPeriodSchema,
  start: z.string(),
  end: z.string(),
  source: z.enum(["hubble", "fixture"]),
  sourceTimestamp: z.string(),
  isPeriodComplete: z.boolean(),
  mode: z.enum(["global", "ego"]),
  account: z.string().optional(),
  nodes: z.array(flowGraphNodeSchema),
  edges: z.array(flowGraphEdgeSchema),
  totals: z.object({
    opCount: z.number().nonnegative(),
    xlmVolume: z.number().nonnegative(),
  }),
});

export type FlowGraphNode = z.infer<typeof flowGraphNodeSchema>;
export type FlowGraphEdge = z.infer<typeof flowGraphEdgeSchema>;
export type FlowGraph = z.infer<typeof flowGraphSchema>;
