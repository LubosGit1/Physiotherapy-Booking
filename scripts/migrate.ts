import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { Pool } from "pg";

export async function runMigrations(connectionString: string) {
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: path.join(import.meta.dirname, "..", "drizzle"),
    });
  } finally {
    await pool.end();
  }
}

// Allow running as a script: `npm run db:migrate`
if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) {
  try {
    process.loadEnvFile();
  } catch {}
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  runMigrations(url).then(() => console.log("Migrations applied."));
}
