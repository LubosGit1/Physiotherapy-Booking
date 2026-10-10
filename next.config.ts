import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the project root so a stray lockfile in a parent folder isn't picked up.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
