/**
 * Flow is enabled explicitly in production. In local development and fixture
 * mode, `?flow=1` can opt into the view while it is being built out.
 */
export function isFlowViewEnabled(input: {
  nodeEnv: string | undefined;
  dataSource: string | undefined;
  envFlag: string | undefined;
  queryFlag: string | undefined;
}): boolean {
  if (input.envFlag?.toLowerCase() === "true") return true;

  const isProduction =
    input.nodeEnv === "production" && input.dataSource !== "fixture";
  const isLocalPreview =
    input.nodeEnv === "development" || input.dataSource === "fixture";

  return (
    !isProduction &&
    isLocalPreview &&
    (input.queryFlag === "1" || input.queryFlag?.toLowerCase() === "true")
  );
}

export function isFlowViewRequested(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "flow";
}

export function flowViewIsEnabled(
  queryFlag?: string | string[],
): boolean {
  return isFlowViewEnabled({
    nodeEnv: process.env.NODE_ENV,
    dataSource: process.env.LUMENMAP_DATA_SOURCE,
    envFlag: process.env.LUMENMAP_ENABLE_FLOW_VIEW,
    queryFlag: Array.isArray(queryFlag) ? queryFlag[0] : queryFlag,
  });
}
