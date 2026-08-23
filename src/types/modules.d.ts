declare module "@/components/BtrApp" {
  const BtrApp: () => JSX.Element;
  export default BtrApp;
}

declare module "*.asset.json" {
  const asset: { url: string; original_filename: string; content_type: string };
  export default asset;
}
