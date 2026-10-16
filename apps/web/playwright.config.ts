import { defineConfig } from "@playwright/test";

// PORT lets several checkouts (e.g. parallel git worktrees) run their own
// dev server + e2e suite side by side without reusing each other's server.
const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: `http://localhost:${port}`,
  },
});
