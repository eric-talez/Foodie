import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: { "server-only": "next/dist/compiled/server-only/empty" },
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
});
