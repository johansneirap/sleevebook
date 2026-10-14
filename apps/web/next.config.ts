import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Monorepo-wide .env lives at the repo root, not in apps/web; dotenv never
// overrides vars a platform (Railway) already injected into process.env.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@sleevebook/binder-core", "@sleevebook/db"],
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};

export default nextConfig;
