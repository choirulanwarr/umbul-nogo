import { createDatabase, databaseUrl } from "../src/db/client";
import { migrateDatabase } from "../src/db/migrate";

async function main(): Promise<void> {
  const connection = createDatabase(
    databaseUrl(process.env.MIGRATION_DATABASE_URL, "umbul_migrator"),
    "umbul_migrator",
  );
  try {
    await migrateDatabase(connection.db);
    console.info("Migrasi database selesai.");
  } finally {
    await connection.close();
  }
}
try {
  await main();
} catch {
  console.error(
    "Migrasi gagal. Periksa konfigurasi, role, akses database, dan versi migrasi; detail koneksi tidak dicetak.",
  );
  process.exitCode = 1;
}
