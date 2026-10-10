import { runMigrations } from "../../scripts/migrate";

export default async function setup() {
  const url = process.env.DATABASE_URL_TEST ?? "postgresql://postgres:postgres@localhost:5432/physio_test";
  if (!url.includes("test")) throw new Error("Refusing to run integration tests against a non-test database.");
  await runMigrations(url);
}
