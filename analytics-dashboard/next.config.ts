import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow the unload event in embedded iframes (Facebook SDK requires it)
          { key: "Permissions-Policy", value: "unload=*" },
        ],
      },
    ];
  },
  images: {
    // Allow ALL remote image sources (Firebase, Facebook CDN, Instagram CDN, etc.)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        pathname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
        pathname: "**",
      },
    ],
    // Disable image optimization for external URLs to avoid domain restrictions
    unoptimized: false,
  },
};

export default nextConfig;
