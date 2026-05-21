import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow ticket photo uploads.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
