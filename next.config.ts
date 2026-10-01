import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    distDir:
      process.env.YAS_ISOLATED_VERIFY === "1"
        ? phase === PHASE_DEVELOPMENT_SERVER
          ? ".next-p18"
          : ".next-p18-build"
        : ".next",
  };
}
