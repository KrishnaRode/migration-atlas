import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Lets a production build run next to a live dev server (CI, smoke tests).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
