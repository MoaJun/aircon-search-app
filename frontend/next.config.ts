import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizeCss: false, // lightningcss を無効にする
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://*.googleapis.com; style-src 'self' 'unsafe-inline' https://maps.googleapis.com https://fonts.googleapis.com; img-src 'self' data: https://maps.gstatic.com https://*.googleapis.com; connect-src 'self' https://maps.googleapis.com https://*.googleapis.com https://aircon-search-backend-tmjs-projects-5256c7ce.vercel.app; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://maps.googleapis.com;`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
