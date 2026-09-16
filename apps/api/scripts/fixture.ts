import { createDatabase } from "../src/db/client";
import { insertDevelopmentFixture } from "../src/db/fixture";
import { assertLocalDatabase, localDatabaseUrl } from "../src/db/local-target";

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEVELOPMENT_FIXTURE !== "umbul_nogo_development"
  )
    throw new Error("Fixture development belum diaktifkan.");
  const url = localDatabaseUrl(
    process.env.MIGRATION_DATABASE_URL,
    "umbul_nogo_development",
    "umbul_migrator",
  );
  const connection = createDatabase(url, "umbul_migrator");
  try {
    await assertLocalDatabase(connection.db, "umbul_nogo_development");
    await insertDevelopmentFixture(connection.db);
    console.info("Fixture development tersembunyi berhasil ditambahkan.");
  } finally {
    await connection.close();
  }
}
try {
  await main();
} catch {
  console.error(
    "Fixture tidak diterapkan. Periksa target lokal, izin eksplisit, migrasi dan kondisi database baru.",
  );
  process.exitCode = 1;
}
