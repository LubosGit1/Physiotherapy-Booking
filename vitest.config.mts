import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Fast tests: pure logic in Node, React components in jsdom. No database.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/components/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["./tests/setup-dom.ts"],
    restoreMocks: true,
  },
});
