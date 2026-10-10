import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile();
} catch {}

const DATABASE_URL = process.env.DATABASE_URL_TEST ?? "postgresql://postgres:postgres@localhost:5432/physio_test";

// Services against a real PostgreSQL – constraints, transactions and races included.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL },
    globalSetup: ["./tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
