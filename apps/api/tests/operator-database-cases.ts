import { expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import type { createDatabase } from "../src/db/client";
import { adminSessions, adminUsers, auditEvents, authThrottles } from "../src/db/schema";
import { manageAccount } from "../src/operator/accounts";
import { createAuthService } from "../src/auth/service";
import { createPasswordVerifier, sha256 } from "../src/auth/crypto";

async function rejection(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail.");
}

type Connections = {
  migration: ReturnType<typeof createDatabase>;
  runtime: ReturnType<typeof createDatabase>;
};
export function registerOperatorDatabaseTests(getConnections: () => Connections): void {
  test("T-07 provisioning, reset/disable, recovery, audit, rollback dan izin runtime", async () => {
    const { migration, runtime } = getConnections();
    const email = `operator-${crypto.randomUUID()}@example.test`;
    const password = "Password fixture operator awal";
    const replacement = "Password fixture operator pengganti";
    const source = `operator-${crypto.randomUUID()}`;
    const signal = new AbortController().signal;
    const service = createAuthService({
      db: runtime.db,
      verifyPassword: await createPasswordVerifier(),
    });
    let userId: string | undefined;
    try {
      const created = await manageAccount(migration.db, {
        action: "create",
        email: ` ${email.toUpperCase()} `,
        password,
      });
      userId = created.userId;
      expect(
        await rejection(
          manageAccount(migration.db, { action: "create", email, password: replacement }),
        ),
      ).toMatchObject({ message: "Akun sudah ada; gunakan reset untuk pemulihan." });
      const first = await service.login(email, password, source, undefined, signal);
      const second = await service.login(email, password, source, undefined, signal);
      const before = (
        await migration.db.select().from(adminUsers).where(eq(adminUsers.id, userId))
      )[0];
      const rollback = new Error("rollback fixture");
      expect(
        await rejection(
          migration.db.transaction(async (tx) => {
            await manageAccount(tx, { action: "reset", email, password: replacement });
            throw rollback;
          }),
        ),
      ).toMatchObject({ message: "rollback fixture" });
      expect(
        (await migration.db.select().from(adminUsers).where(eq(adminUsers.id, userId)))[0],
      ).toEqual(before);
      expect((await service.authenticate(first.token, signal)).user.id).toBe(userId);
      expect(
        await migration.db.select().from(auditEvents).where(eq(auditEvents.resourceId, userId)),
      ).toHaveLength(1);
      await manageAccount(migration.db, { action: "reset", email, password: replacement });
      for (const token of [first.token, second.token])
        expect(await rejection(service.authenticate(token, signal))).toMatchObject({
          detail: { code: "AUTH_REQUIRED" },
        });
      expect(
        await rejection(service.login(email, password, source, undefined, signal)),
      ).toMatchObject({ detail: { code: "INVALID_CREDENTIALS" } });
      const third = await service.login(email, replacement, source, undefined, signal);
      await manageAccount(migration.db, { action: "disable", email });
      expect(await rejection(service.authenticate(third.token, signal))).toMatchObject({
        detail: { code: "AUTH_REQUIRED" },
      });
      expect(
        await rejection(service.login(email, replacement, source, undefined, signal)),
      ).toMatchObject({ detail: { code: "INVALID_CREDENTIALS" } });
      await manageAccount(migration.db, { action: "reset", email, password });
      // Recovery does not bypass throttles. Clear only this test account's reserved bucket.
      await migration.db
        .delete(authThrottles)
        .where(eq(authThrottles.bucketKey, `email:${sha256(email)}`));
      expect(
        (await service.login(email, password, source, undefined, signal)).session.user.id,
      ).toBe(userId);
      const audits = await migration.db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.resourceId, userId));
      expect(audits.map((row) => row.action).sort()).toEqual([
        "operator.account.create",
        "operator.account.disable",
        "operator.account.reset",
        "operator.account.reset",
      ]);
      expect(audits.every((row) => row.actorId === null && row.resourceType === "admin_user")).toBe(
        true,
      );
      const serialized = JSON.stringify(audits);
      for (const secret of [
        email,
        password,
        replacement,
        first.token,
        before?.passwordHash ?? "missing",
      ])
        expect(serialized).not.toContain(secret);
      expect(
        await rejection(manageAccount(runtime.db, { action: "disable", email })),
      ).toBeInstanceOf(Error);
      expect(
        await rejection(manageAccount(migration.db, { action: "reset", email, password: "short" })),
      ).toBeInstanceOf(Error);
      expect(
        (await migration.db.select().from(adminUsers).where(eq(adminUsers.id, userId)))[0]
          ?.isActive,
      ).toBe(true);
    } finally {
      if (userId) {
        await migration.db.delete(adminSessions).where(eq(adminSessions.adminUserId, userId));
        await migration.db.delete(auditEvents).where(eq(auditEvents.resourceId, userId));
        await migration.db.delete(adminUsers).where(eq(adminUsers.id, userId));
      }
      await migration.db
        .delete(authThrottles)
        .where(
          inArray(authThrottles.bucketKey, [`email:${sha256(email)}`, `source:${sha256(source)}`]),
        );
    }
  });
}
