/** Resets the dev database to the demo clinic:  npm run db:seed */
export {};

try {
  process.loadEnvFile();
} catch {}

const { pool } = await import("@/db");
const { FIXTURE_PASSWORD, FIXTURE_USERS, resetDatabase } = await import("@/server/test-support/fixtures");

await resetDatabase();
console.log(`Seeded the demo clinic. Every account uses the password "${FIXTURE_PASSWORD}":`);
for (const user of Object.values(FIXTURE_USERS)) console.log(`  ${user.role.padEnd(9)} ${user.email}`);
await pool.end();
