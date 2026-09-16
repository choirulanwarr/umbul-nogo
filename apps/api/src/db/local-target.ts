import { sql } from "drizzle-orm";
import type { Database, DatabaseRole } from "./client";
import { databaseUrl } from "./client";

export type LocalDatabase = "umbul_nogo_development" | "umbul_nogo_test";
export function localDatabaseUrl(
  value: string | undefined,
  target: LocalDatabase,
  role: DatabaseRole,
): string {
  const validated = databaseUrl(value, role);
  const url = new URL(validated);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    decodeURIComponent(url.pathname.slice(1)) !== target ||
    url.search !== "" ||
    url.hash !== "" ||
    url.port !== (target === "umbul_nogo_test" ? "5434" : "5433")
  ) {
    throw new Error("Target harus database lokal terisolasi yang ditetapkan.");
  }
  return validated;
}
export async function assertLocalDatabase(
  db: Database,
  target: LocalDatabase,
  role: DatabaseRole = "umbul_migrator",
): Promise<void> {
  const [identity] = await db.execute<{ databaseName: string; role: string }>(
    sql`select current_database() as "databaseName", current_user as role`,
  );
  if (identity?.databaseName !== target || identity.role !== role)
    throw new Error("Identitas koneksi database lokal tidak sesuai target.");
}
