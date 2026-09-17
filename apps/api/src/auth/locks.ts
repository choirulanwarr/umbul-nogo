import { sql } from "drizzle-orm";
import type { Database } from "../db/client";

// T-07 reset/disable and subsequent authenticated content transactions must use
// this same account lock before changing accounts or revoking/checking sessions.
export async function lockAccounts(tx: Database, ids: string[]): Promise<void> {
  for (const id of [...new Set(ids)].sort())
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 74106))`);
}
export async function authTimeouts(tx: Database): Promise<void> {
  await tx.execute(sql`set local statement_timeout = '2s'`);
  await tx.execute(sql`set local lock_timeout = '1s'`);
}
