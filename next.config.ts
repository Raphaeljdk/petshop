import type { NextConfig } from "next";

const nextConfig = {
  output: "standalone",
  experimental: {
    useTypeScriptCli: false,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
} as NextConfig;

export default nextConfig;
