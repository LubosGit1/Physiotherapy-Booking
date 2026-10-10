import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {
  // .env is optional – CI provides variables directly
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
