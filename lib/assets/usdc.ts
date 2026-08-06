import usdcAssets from "@/data/usdc-assets.json";

export interface AssetIdentity {
  code: string;
  issuer: string;
}

export interface AssetProvenance {
  label: string;
  url: string;
}

export interface SupportedUsdcAsset extends AssetIdentity {
  name: string;
  provenance: AssetProvenance[];
}

export interface SupportedUsdcAssetSet {
  id: string;
  methodology: string;
  assets: SupportedUsdcAsset[];
}

export const SUPPORTED_USDC_ASSET_SET =
  usdcAssets as SupportedUsdcAssetSet;

export function getSupportedUsdcAssets(): SupportedUsdcAsset[] {
  return SUPPORTED_USDC_ASSET_SET.assets;
}

export function isSupportedUsdcAsset(identity: AssetIdentity): boolean {
  return SUPPORTED_USDC_ASSET_SET.assets.some(
    (asset) =>
      asset.code === identity.code && asset.issuer === identity.issuer,
  );
}

