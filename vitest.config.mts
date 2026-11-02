import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // Next's "server-only" guard throws outside React Server Components.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/empty.ts"),
    },
  },
  test: { include: ["test/**/*.test.ts"] },
});
