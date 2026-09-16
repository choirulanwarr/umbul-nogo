import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

export type DatabaseRole = "umbul_runtime" | "umbul_migrator";
export function databaseUrl(value: string | undefined, role: DatabaseRole): string {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      decodeURIComponent(url.username) !== role ||
      !url.hostname ||
      url.pathname.length < 2 ||
      !url.password ||
      url.searchParams.has("user") ||
      url.searchParams.has("options")
    )
      throw new Error();
    return value;
  } catch {
    // Do not expose URLs, passwords, or provider parse errors.
    throw new Error(`Konfigurasi koneksi untuk ${role} tidak sah.`);
  }
}

export function createDatabase(url: string, role: DatabaseRole = "umbul_runtime") {
  const client = new SQL(databaseUrl(url, role), {
    max: role === "umbul_runtime" ? 10 : 1,
    idleTimeout: 20,
    connectionTimeout: 5,
  });
  const db = drizzle(client, { schema, logger: false });
  return { db, close: () => client.close({ timeout: 5 }) };
}
export type Database = BunSQLDatabase<typeof schema>;
