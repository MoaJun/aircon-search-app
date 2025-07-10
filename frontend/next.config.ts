import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizeCss: false, // lightningcss を無効にする
  },
};

export default nextConfig;
