import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "",
  assetPrefix: "",
  pageExtensions: process.env.NODE_ENV === "development"
    ? ["dev.tsx", "js", "jsx", "md", "mdx", "ts", "tsx"]
    : ["js", "jsx", "md", "mdx", "ts", "tsx"],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
