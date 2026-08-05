import { z } from "zod";

export const finiteNumberSchema = z.number().finite();

export const decimalStringSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Number(value)), {
    message: "Invalid decimal string",
  });

export const isoTimestampSchema = z.string().datetime({ offset: true });

export const periodSchema = z.enum(["1d", "7d", "30d", "month"]);

export const dataSourceSchema = z.literal("hubble");

export const countUnitSchema = z.object({
  kind: z.literal("count"),
  subject: z.enum(["operation", "transaction"]),
});

export const assetUnitSchema = z.object({
  kind: z.literal("asset"),
  asset: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("native"),
      code: z.literal("XLM"),
    }),
    z.object({
      type: z.literal("issued"),
      code: z.string().min(1),
      issuer: z.string().min(1),
    }),
  ]),
});

export const operationsMetricSchema = z.object({
  kind: z.literal("operations"),
  unit: z.literal("ops"),
  value: finiteNumberSchema,
});

export const shareMetricSchema = z.object({
  kind: z.literal("share"),
  unit: z.literal("percent"),
  value: finiteNumberSchema,
});

export const entityCountMetricSchema = z.object({
  kind: z.literal("entity_count"),
  unit: z.literal("count"),
  value: finiteNumberSchema,
});

export const activityKpisSchema = z.object({
  totalOps: operationsMetricSchema,
  sorobanShare: shareMetricSchema,
  topCategory: z.string().min(1),
  activeContracts: entityCountMetricSchema,
});

export const treemapNodeTypeSchema = z.enum([
  "root",
  "category",
  "entity",
  "contract",
  "account",
]);

export const treemapNodeMetaSchema = z.object({
  type: treemapNodeTypeSchema,
  id: z.string().optional(),
  category: z.string().optional(),
  protocol: z.string().optional(),
  share: finiteNumberSchema.optional(),
  opCount: finiteNumberSchema.optional(),
  xlmVolume: finiteNumberSchema.optional(),
  childCount: finiteNumberSchema.optional(),
  eventType: z.string().optional(),
});

type CountTreemapNode = {
  id?: string;
  name: string;
  value?: number;
  color?: string;
  children?: CountTreemapNode[];
  meta?: z.infer<typeof treemapNodeMetaSchema>;
};

type AssetTreemapNode = {
  id?: string;
  name: string;
  value?: string;
  color?: string;
  children?: AssetTreemapNode[];
  meta?: z.infer<typeof treemapNodeMetaSchema>;
};

function withLeafValueRule<T extends CountTreemapNode | AssetTreemapNode>(
  schema: z.ZodType<T>,
) {
  return schema.superRefine((node, ctx) => {
    const hasChildren =
      Array.isArray(node.children) && node.children.length > 0;
    const hasValue = node.value !== undefined;

    if (!hasChildren && !hasValue) {
      ctx.addIssue({
        code: "custom",
        message:
          "Treemap leaf node must have a finite value when it has no children",
        path: ["value"],
      });
    }
  });
}

export const countTreemapNodeSchema: z.ZodType<CountTreemapNode> = z.lazy(() =>
  withLeafValueRule(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      value: finiteNumberSchema.optional(),
      color: z.string().optional(),
      children: z.array(countTreemapNodeSchema).optional(),
      meta: treemapNodeMetaSchema.optional(),
    }),
  ),
);

export const assetTreemapNodeSchema: z.ZodType<AssetTreemapNode> = z.lazy(() =>
  withLeafValueRule(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      value: decimalStringSchema.optional(),
      color: z.string().optional(),
      children: z.array(assetTreemapNodeSchema).optional(),
      meta: treemapNodeMetaSchema.optional(),
    }),
  ),
);

export const operationTreemapSchema = z.intersection(
  countTreemapNodeSchema,
  z.object({
    metric: z.literal("operation_count"),
    unit: countUnitSchema.refine((unit) => unit.subject === "operation", {
      message: 'Operation treemap must use count unit subject "operation"',
    }),
  }),
);

export const assetVolumeTreemapSchema = z.intersection(
  assetTreemapNodeSchema,
  z.object({
    metric: z.literal("asset_volume"),
    unit: assetUnitSchema,
  }),
);

const methodologySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  href: z.string().min(1),
});

const sourceDetailsSchema = z.object({
  provider: z.literal("hubble"),
  dataset: z.string().min(1),
  tables: z.array(z.string().min(1)).min(1),
});

const coverageConstraintSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("time_bounds"),
    semantics: z.literal("inclusive"),
    startField: z.literal("start"),
    endField: z.literal("end"),
  }),
  z.object({
    kind: z.literal("partial_period"),
    completenessField: z.literal("isPeriodComplete"),
  }),
  z.object({
    kind: z.literal("source_lag"),
    watermarkField: z.literal("sourceTimestamp"),
  }),
  z.object({
    kind: z.literal("top_n"),
    appliesTo: z.enum([
      "account_children",
      "contract_children",
      "soroban_function_children",
      "contracts_per_function",
    ]),
    limit: finiteNumberSchema,
    partitionBy: z.enum(["type_string", "function_name"]).optional(),
  }),
  z.object({
    kind: z.literal("filter"),
    field: z.literal("asset_type"),
    operator: z.literal("equals"),
    value: z.literal("native"),
  }),
]);

const operationMetricProvenanceSchema = z.object({
  metric: z.literal("operation_count"),
  methodology: methodologySchema.extend({
    id: z.literal("operations"),
  }),
  source: sourceDetailsSchema,
  aggregation: z.object({
    kind: z.literal("count"),
    function: z.literal("COUNT(*)"),
    granularity: z.literal("selected_period"),
    dimensions: z.array(z.string()).min(1),
  }),
  coverage: z.object({
    network: z.literal("stellar_mainnet"),
    constraints: z.array(coverageConstraintSchema).min(1),
  }),
});

const assetVolumeMetricProvenanceSchema = z.object({
  metric: z.literal("asset_volume"),
  methodology: methodologySchema.extend({
    id: z.literal("payment-volume"),
  }),
  source: sourceDetailsSchema,
  aggregation: z.object({
    kind: z.literal("sum"),
    field: z.literal("amount"),
    granularity: z.literal("selected_period"),
    dimensions: z.array(z.string()).min(1),
  }),
  coverage: z.object({
    network: z.literal("stellar_mainnet"),
    constraints: z.array(coverageConstraintSchema).min(1),
  }),
});

export const activityMetricProvenanceSchema = z.object({
  operation_count: operationMetricProvenanceSchema,
  asset_volume: assetVolumeMetricProvenanceSchema,
});

export const activityResponseSchema = z.object({
  period: periodSchema,
  start: isoTimestampSchema,
  end: isoTimestampSchema,
  source: dataSourceSchema,
  sourceTimestamp: isoTimestampSchema,
  isPeriodComplete: z.boolean(),
  kpis: activityKpisSchema,
  treemaps: z.object({
    events: operationTreemapSchema,
    actors: operationTreemapSchema,
    xlm_events: assetVolumeTreemapSchema,
    xlm_actors: assetVolumeTreemapSchema,
  }),
  metricProvenance: activityMetricProvenanceSchema,
});

export type ActivityResponse = z.infer<typeof activityResponseSchema>;
export type ActivityKpis = z.infer<typeof activityKpisSchema>;
