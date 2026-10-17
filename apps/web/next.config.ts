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
  async headers() {
    return [
      {
        // Binder embeds (iframe) may be placed on any site.
        source: "/e/:slug",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        // Everything else (the app itself) refuses to be framed by other sites.
        // The negative lookahead keeps /e/* out of this rule.
        source: "/:path((?!e/).*)?",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
