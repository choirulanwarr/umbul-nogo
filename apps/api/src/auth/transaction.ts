import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { adminSessions, adminUsers } from "../db/schema";
import { failure } from "../http/errors";
import { sha256 } from "./crypto";
import { IDLE_SESSION_MS } from "./cookie";
import { lockAccounts } from "./locks";

// Keep this lock until the caller's content transaction commits. A SessionDto
// from the HTTP guard alone is not authorization to commit after revocation.
export async function requireTransactionSession(
  tx: Database,
  token: string | undefined,
  now: () => number,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  if (!token) throw failure("AUTH_REQUIRED");
  const tokenHash = sha256(token);
  const [owner] = await tx
    .select({ userId: adminSessions.adminUserId })
    .from(adminSessions)
    .where(eq(adminSessions.tokenHash, tokenHash));
  if (!owner) throw failure("AUTH_REQUIRED");
  await lockAccounts(tx, [owner.userId]);
  const [entry] = await tx
    .select({ session: adminSessions, active: adminUsers.isActive })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
    .where(eq(adminSessions.tokenHash, tokenHash))
    .for("update", { of: adminSessions });
  const time = now();
  if (
    !entry?.active ||
    Date.parse(entry.session.expiresAt) <= time ||
    Date.parse(entry.session.lastSeenAt) + IDLE_SESSION_MS <= time
  )
    throw failure("AUTH_REQUIRED");
  signal.throwIfAborted();
  return owner.userId;
}
