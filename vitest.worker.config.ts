import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests des Workers in der echten Workers-Runtime (Miniflare)
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    name: "worker",
    include: ["test/worker/**/*.test.ts"],
  },
});
