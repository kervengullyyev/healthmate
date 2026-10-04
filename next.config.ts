import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Preserve the exact OAuth origin: Google treats 127.0.0.1 and localhost differently.
  skipProxyUrlNormalize: true,
  devIndicators: false,
  turbopack: { root: process.cwd() },
};
export default config;
