import { createDatabase, databaseUrl } from "../src/db/client";
import { cleanupReceipts } from "../src/content/service";

async function main(): Promise<void> {
  const connection = createDatabase(databaseUrl(process.env.DATABASE_URL, "umbul_runtime"));
  try {
    const receipts = await cleanupReceipts(connection.db);
    console.info(JSON.stringify({ event: "receipt_cleanup", receipts }));
  } finally {
    await connection.close();
  }
}
try {
  await main();
} catch {
  console.error(JSON.stringify({ event: "receipt_cleanup_failed" }));
  process.exitCode = 1;
}
