import type { NextConfig } from "next";

const nextConfig = {
  output: "standalone",
  // libxml2-wasm usa node:module e artefatos WASM; não empacotar com webpack.
  serverExternalPackages: ["libxml2-wasm"],

  outputFileTracingIncludes: {
    '/api/admin/fiscal/**/*': ['./public/fiscal-schemas/*.zip', './node_modules/libxml2-wasm/**/*.wasm'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
} as NextConfig;

export default nextConfig;
