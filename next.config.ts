import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local-only: this project lives under ~/Desktop, which iCloud Drive syncs.
  // iCloud evicts/races on the high-churn build dir, corrupting `.next` (missing
  // manifests, failed SST writes). The `.nosync` suffix is honored by iCloud and
  // excludes the dir from sync, while keeping it in the project tree so Turbopack
  // can still resolve node_modules. On Vercel there's no iCloud — use the default
  // `.next` so the platform's Next.js builder finds the output where it expects.
  ...(process.env.VERCEL ? {} : { distDir: ".next.nosync" }),
};

export default nextConfig;
