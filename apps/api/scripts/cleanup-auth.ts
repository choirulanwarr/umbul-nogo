import { createDatabase, databaseUrl } from "../src/db/client";
import { cleanupAuth } from "../src/auth/service";

async function main(): Promise<void> {
  const connection = createDatabase(databaseUrl(process.env.DATABASE_URL, "umbul_runtime"));
  try {
    const counts = await cleanupAuth(connection.db);
    console.info(JSON.stringify({ event: "auth_cleanup", ...counts }));
  } finally {
    await connection.close();
  }
}
try {
  await main();
} catch {
  console.error(JSON.stringify({ event: "auth_cleanup_failed" }));
  process.exitCode = 1;
}
