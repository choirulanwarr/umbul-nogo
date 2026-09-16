import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { fileURLToPath } from "node:url";
import type { Database } from "./client";

export const migrationsFolder = fileURLToPath(new URL("../../../migrations/", import.meta.url));
export async function migrateDatabase(db: Database): Promise<void> {
  const migrations = readMigrationFiles({ migrationsFolder });
  // Apply Drizzle's generated statements on one transaction. The stock Bun SQL
  // migrator starts its own session transaction; do not nest that under a lock
  // transaction and assume it will use the same connection/savepoint.
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '10s'`);
    await tx.execute(sql`set local statement_timeout = '60s'`);
    await tx.execute(sql`select pg_advisory_xact_lock(74104, 1)`);
    await tx.execute(sql`DO $$ BEGIN
      IF current_user <> 'umbul_migrator' OR EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolcreatedb OR rolcreaterole)
      ) THEN RAISE EXCEPTION 'Dedicated migration role required'; END IF;
    END $$`);
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL UNIQUE
    )`);
    const applied = await tx.execute<{ hash: string; created_at: string }>(
      sql`SELECT hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at`,
    );
    // Refuse edited/missing history or a database newer than this checkout.
    for (const [index, entry] of applied.entries()) {
      const migration = migrations[index];
      if (
        !migration ||
        entry.hash !== migration.hash ||
        entry.created_at !== String(migration.folderMillis)
      )
        throw new Error("Riwayat migrasi berbeda dari checkout ini.");
    }
    for (const migration of migrations.slice(applied.length)) {
      for (const statement of migration.sql) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      await tx.execute(
        sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${migration.hash}, ${migration.folderMillis})`,
      );
    }
  });
}
