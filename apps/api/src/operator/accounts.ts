import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { loginRequestSchema } from "@umbul-nogo/contracts/auth";
import type { Database } from "../db/client";
import { adminSessions, adminUsers, auditEvents } from "../db/schema";
import { hashPassword } from "../auth/crypto";
import { authTimeouts, lockAccounts } from "../auth/locks";

export type AccountCommand =
  | { action: "create" | "reset"; email: string; password: string }
  | { action: "disable"; email: string };

export class AccountOperationError extends Error {}

// Only the operator CLI imports this service. The runtime DB role cannot write accounts.
export async function manageAccount(db: Database, command: AccountCommand) {
  const email = loginRequestSchema.shape.email.parse(command.email);
  const passwordHash =
    command.action === "disable" ? undefined : await hashPassword(command.password);
  const requestId = randomUUID();
  return db.transaction(async (tx) => {
    await authTimeouts(tx);
    let userId: string;
    if (command.action === "create") {
      if (!passwordHash) throw new AccountOperationError("Kata sandi wajib diisi.");
      const [user] = await tx
        .insert(adminUsers)
        .values({ email, passwordHash })
        .onConflictDoNothing({ target: adminUsers.email })
        .returning({ id: adminUsers.id });
      if (!user) throw new AccountOperationError("Akun sudah ada; gunakan reset untuk pemulihan.");
      userId = user.id;
    } else {
      const [candidate] = await tx
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(eq(adminUsers.email, email));
      if (!candidate) throw new AccountOperationError("Akun tidak ditemukan.");
      userId = candidate.id;
      await lockAccounts(tx, [userId]);
      const [updated] = await tx
        .update(adminUsers)
        .set({
          ...(command.action === "disable"
            ? { isActive: false }
            : { passwordHash, isActive: true }),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(adminUsers.id, userId))
        .returning({ id: adminUsers.id });
      if (!updated) throw new AccountOperationError("Akun tidak ditemukan.");
      await tx.delete(adminSessions).where(eq(adminSessions.adminUserId, userId));
    }
    // No credential, email, or form values in the audit. A CLI operator has no web actor.
    await tx.insert(auditEvents).values({
      actorId: null,
      action: `operator.account.${command.action}`,
      resourceType: "admin_user",
      resourceId: userId,
      requestId,
    });
    return { event: `operator.account.${command.action}`, userId, requestId };
  });
}
