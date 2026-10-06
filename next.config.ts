import type { NextConfig } from "next";

const nextConfig = {
  output: "standalone",

  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
} as NextConfig;

export default nextConfig;
