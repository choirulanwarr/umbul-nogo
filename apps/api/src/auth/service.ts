import { and, eq, sql } from "drizzle-orm";
import { sessionSchema } from "@umbul-nogo/contracts/auth";
import type { SessionDto } from "@umbul-nogo/contracts/auth";
import type { Database } from "../db/client";
import { adminSessions, adminUsers, authThrottles } from "../db/schema";
import { failure, HttpError } from "../http/errors";
import { ABSOLUTE_SESSION_MS, IDLE_SESSION_MS } from "./cookie";
import { newSessionToken, sha256 } from "./crypto";
import { authTimeouts, lockAccounts } from "./locks";

export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export type AuthDependencies = {
  db: Database;
  verifyPassword: (password: string, hash: string | undefined) => Promise<boolean>;
  now?: () => number;
};
export type AuthService = {
  login: (
    email: string,
    password: string,
    source: string,
    oldToken: string | undefined,
    signal: AbortSignal,
  ) => Promise<{ token: string; session: SessionDto }>;
  authenticate: (token: string | undefined, signal: AbortSignal) => Promise<SessionDto>;
  logout: (token: string | undefined, signal: AbortSignal) => Promise<void>;
};
function invalidCredentials(): HttpError {
  return new HttpError({
    code: "INVALID_CREDENTIALS",
    message: "Email atau kata sandi tidak sesuai.",
  });
}
async function databaseOperation<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw failure("SERVICE_UNAVAILABLE");
  }
}
function sessionDto(
  user: { id: string; email: string },
  expiresAt: string,
  lastSeenAt: string,
): SessionDto {
  return sessionSchema.parse({
    user: { id: user.id, email: user.email, role: "admin" },
    expiresAt: new Date(expiresAt).toISOString(),
    idleExpiresAt: new Date(
      Math.min(Date.parse(expiresAt), Date.parse(lastSeenAt) + IDLE_SESSION_MS),
    ).toISOString(),
  });
}
export function createAuthService({
  db,
  verifyPassword,
  now = Date.now,
}: AuthDependencies): AuthService {
  async function reserveAttempt(email: string, source: string, signal: AbortSignal): Promise<void> {
    const retryAfter = await db.transaction(async (tx) => {
      await authTimeouts(tx);
      const buckets = [
        { key: `email:${sha256(email)}`, limit: 5 },
        { key: `source:${sha256(source)}`, limit: 30 },
      ];
      const rows: Array<{ key: string; limit: number; count: number; start: number }> = [];
      // Fixed lock order: email then source. Insert+row-lock serializes new and
      // existing buckets across processes; the reservation commits before hashing.
      for (const bucket of buckets) {
        signal.throwIfAborted();
        await tx
          .insert(authThrottles)
          .values({ bucketKey: bucket.key, windowStart: new Date(now()).toISOString() })
          .onConflictDoNothing();
        const [row] = await tx
          .select()
          .from(authThrottles)
          .where(eq(authThrottles.bucketKey, bucket.key))
          .for("update");
        if (!row) throw failure("SERVICE_UNAVAILABLE");
        rows.push({
          key: bucket.key,
          limit: bucket.limit,
          count: row.attemptCount,
          start: Date.parse(row.windowStart),
        });
      }
      const time = now();
      const wait = Math.max(
        0,
        ...rows.map((row) =>
          row.start + THROTTLE_WINDOW_MS > time && row.count >= row.limit
            ? row.start + THROTTLE_WINDOW_MS - time
            : 0,
        ),
      );
      if (wait > 0) return Math.ceil(wait / 1000);
      signal.throwIfAborted();
      for (const row of rows) {
        const expired = row.start + THROTTLE_WINDOW_MS <= time;
        const count = (expired ? 0 : row.count) + 1;
        const start = expired ? time : row.start;
        await tx
          .update(authThrottles)
          .set({
            windowStart: new Date(start).toISOString(),
            attemptCount: count,
            blockedUntil:
              count >= row.limit ? new Date(start + THROTTLE_WINDOW_MS).toISOString() : null,
          })
          .where(eq(authThrottles.bucketKey, row.key));
      }
      return 0;
    });
    if (retryAfter > 0)
      throw new HttpError(
        { code: "RATE_LIMITED", message: "Terlalu banyak percobaan masuk. Coba kembali nanti." },
        { "Retry-After": String(retryAfter) },
      );
  }
  return {
    login: (email, password, source, oldToken, signal) =>
      databaseOperation(async () => {
        await reserveAttempt(email, source, signal);
        signal.throwIfAborted();
        const [candidate] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
        const verified = await verifyPassword(password, candidate?.passwordHash);
        signal.throwIfAborted();
        if (!verified || !candidate?.isActive) throw invalidCredentials();
        return db.transaction(async (tx) => {
          await authTimeouts(tx);
          const oldHash = oldToken ? sha256(oldToken) : undefined;
          const [old] = oldHash
            ? await tx
                .select({ userId: adminSessions.adminUserId })
                .from(adminSessions)
                .where(eq(adminSessions.tokenHash, oldHash))
            : [];
          await lockAccounts(tx, [candidate.id, ...(old ? [old.userId] : [])]);
          const [current] = await tx
            .select()
            .from(adminUsers)
            .where(eq(adminUsers.id, candidate.id));
          // A password reset/disable during expensive verification cannot mint a
          // new session using the stale hash. Operator scripts share account locks.
          if (!current?.isActive || current.passwordHash !== candidate.passwordHash)
            throw invalidCredentials();
          signal.throwIfAborted();
          const token = newSessionToken();
          const created = now();
          const expiresAt = new Date(created + ABSOLUTE_SESSION_MS).toISOString();
          const lastSeenAt = new Date(created).toISOString();
          if (oldHash) await tx.delete(adminSessions).where(eq(adminSessions.tokenHash, oldHash));
          await tx.insert(adminSessions).values({
            adminUserId: current.id,
            tokenHash: sha256(token),
            createdAt: lastSeenAt,
            lastSeenAt,
            expiresAt,
          });
          return { token, session: sessionDto(current, expiresAt, lastSeenAt) };
        });
      }),
    authenticate: (token, signal) =>
      databaseOperation(async () => {
        if (!token) throw failure("AUTH_REQUIRED");
        const tokenHash = sha256(token);
        return db.transaction(async (tx) => {
          await authTimeouts(tx);
          const [owner] = await tx
            .select({ userId: adminSessions.adminUserId })
            .from(adminSessions)
            .where(eq(adminSessions.tokenHash, tokenHash));
          if (!owner) throw failure("AUTH_REQUIRED");
          await lockAccounts(tx, [owner.userId]);
          const [entry] = await tx
            .select({ session: adminSessions, user: adminUsers })
            .from(adminSessions)
            .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
            .where(eq(adminSessions.tokenHash, tokenHash))
            .for("update", { of: adminSessions });
          const time = now();
          if (
            !entry?.user.isActive ||
            Date.parse(entry.session.expiresAt) <= time ||
            Date.parse(entry.session.lastSeenAt) + IDLE_SESSION_MS <= time
          )
            throw failure("AUTH_REQUIRED");
          signal.throwIfAborted();
          // A backwards clock adjustment must not move activity before creation.
          const lastSeenAt = new Date(
            Math.max(time, Date.parse(entry.session.lastSeenAt)),
          ).toISOString();
          await tx
            .update(adminSessions)
            .set({ lastSeenAt })
            .where(eq(adminSessions.id, entry.session.id));
          return sessionDto(entry.user, entry.session.expiresAt, lastSeenAt);
        });
      }),
    logout: (token, signal) =>
      databaseOperation(async () => {
        if (!token) return;
        const tokenHash = sha256(token);
        await db.transaction(async (tx) => {
          await authTimeouts(tx);
          const [owner] = await tx
            .select({ userId: adminSessions.adminUserId })
            .from(adminSessions)
            .where(eq(adminSessions.tokenHash, tokenHash));
          if (!owner) return;
          await lockAccounts(tx, [owner.userId]);
          signal.throwIfAborted();
          await tx
            .delete(adminSessions)
            .where(
              and(
                eq(adminSessions.tokenHash, tokenHash),
                eq(adminSessions.adminUserId, owner.userId),
              ),
            );
        });
      }),
  };
}

// Bounded operational job. Expiry checks are always enforced by authenticate;
// cleanup frequency does not extend the validity of a session or throttle.
export async function cleanupAuth(
  db: Database,
  time = Date.now(),
): Promise<{ sessions: number; counters: number }> {
  return databaseOperation(() =>
    db.transaction(async (tx) => {
      await authTimeouts(tx);
      const nowIso = new Date(time).toISOString();
      const idleCutoff = new Date(time - IDLE_SESSION_MS).toISOString();
      const windowCutoff = new Date(time - THROTTLE_WINDOW_MS).toISOString();
      const sessions = await tx.execute(
        sql`WITH expired AS (SELECT id FROM admin_sessions WHERE expires_at <= ${nowIso}::timestamptz OR last_seen_at <= ${idleCutoff}::timestamptz ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED) DELETE FROM admin_sessions USING expired WHERE admin_sessions.id = expired.id RETURNING admin_sessions.id`,
      );
      const counters = await tx.execute(
        sql`WITH expired AS (SELECT bucket_key FROM auth_throttles WHERE window_start <= ${windowCutoff}::timestamptz AND (blocked_until IS NULL OR blocked_until <= ${nowIso}::timestamptz) ORDER BY window_start LIMIT 1000 FOR UPDATE SKIP LOCKED) DELETE FROM auth_throttles USING expired WHERE auth_throttles.bucket_key = expired.bucket_key RETURNING auth_throttles.bucket_key`,
      );
      return { sessions: sessions.length, counters: counters.length };
    }),
  );
}
