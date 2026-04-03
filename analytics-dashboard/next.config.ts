import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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
