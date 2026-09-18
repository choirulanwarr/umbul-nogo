import { expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { operationsRequestSchema, operationsFieldsSchema } from "@umbul-nogo/contracts/operations";
import { ticketRateCreateSchema, ticketRateFieldsSchema } from "@umbul-nogo/contracts/ticket-rates";
import { contentVersionSchema } from "@umbul-nogo/contracts/primitives";
import type { createDatabase } from "../src/db/client";
import type { Database } from "../src/db/client";
import {
  adminSessions,
  adminUsers,
  auditEvents,
  mutationReceipts,
  operationsSettings,
  siteState,
  ticketRates,
} from "../src/db/schema";
import { hashPassword, newSessionToken, sha256 } from "../src/auth/crypto";
import {
  createContentService,
  cleanupReceipts,
  RECEIPT_RETENTION_MS,
} from "../src/content/service";
import type { MutationRequest, MutationDefinition } from "../src/content/service";
import { HttpError, failure } from "../src/http/errors";
import { manageAccount } from "../src/operator/accounts";

type Connections = {
  migration: ReturnType<typeof createDatabase>;
  runtime: ReturnType<typeof createDatabase>;
};
async function errorCode(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    if (error instanceof HttpError) return error.detail.code;
    throw error;
  }
  throw new Error("Expected content failure.");
}
const operations = {
  monthlyBudgetIdr: null,
  destinationManagerName: null,
  destinationManagerPhone: null,
  destinationManagerEmail: null,
  technicalOperatorName: null,
  technicalOperatorPhone: null,
  technicalOperatorEmail: null,
  internalNotes: null,
};
const privateDefinition: MutationDefinition<z.output<typeof operationsRequestSchema>> = {
  schema: operationsRequestSchema,
  project: () => Promise.resolve({ public: null, tickets: [] }),
  apply: async (tx, input) => {
    const fields = operationsFieldsSchema.strip().parse(input);
    await tx.update(operationsSettings).set(fields).where(eq(operationsSettings.id, 1));
    return { data: fields, resourceId: null };
  },
};
async function publicTickets(tx: Database) {
  const rows = await tx
    .select({
      id: ticketRates.id,
      name: ticketRates.name,
      priceIdr: ticketRates.priceIdr,
      unit: ticketRates.unit,
      terms: ticketRates.terms,
      applicabilityNote: ticketRates.applicabilityNote,
    })
    .from(ticketRates)
    .where(eq(ticketRates.isVisible, true))
    .orderBy(ticketRates.sortOrder, ticketRates.id);
  return { public: rows, tickets: rows };
}
async function withContent(
  connections: Connections,
  run: (f: {
    service: ReturnType<typeof createContentService>;
    db: Database;
    userIds: string[];
    request: (input?: unknown, actor?: number) => MutationRequest;
    createTicket: MutationDefinition<z.output<typeof ticketRateCreateSchema>>;
    time: () => number;
    advance: (ms: number) => void;
    renew: () => Promise<void>;
  }) => Promise<void>,
): Promise<void> {
  const db = connections.runtime.db;
  const admin = connections.migration.db;
  const [state] = await db.select().from(siteState);
  const [settings] = await db.select().from(operationsSettings);
  if (!state || !settings) throw new Error("Missing fixture state.");
  let time = Date.parse("2030-01-01T00:00:00Z");
  const tokens = [newSessionToken(), newSessionToken()];
  const users = await admin
    .insert(adminUsers)
    .values(
      await Promise.all(
        tokens.map(async () => ({
          email: `content-${crypto.randomUUID()}@example.test`,
          passwordHash: await hashPassword("Content fixture password only"),
        })),
      ),
    )
    .returning({ id: adminUsers.id });
  const userIds = users.map((user) => user.id);
  const ticketIds: string[] = [];
  const renew = async () => {
    await admin.delete(adminSessions).where(inArray(adminSessions.adminUserId, userIds));
    await admin.insert(adminSessions).values(
      users.map((user, index) => ({
        adminUserId: user.id,
        tokenHash: sha256(tokens[index]!),
        createdAt: new Date(time).toISOString(),
        lastSeenAt: new Date(time).toISOString(),
        expiresAt: new Date(time + 8 * 60 * 60 * 1000).toISOString(),
      })),
    );
  };
  const service = createContentService({ db, now: () => time });
  const createTicket: MutationDefinition<z.output<typeof ticketRateCreateSchema>> = {
    schema: ticketRateCreateSchema,
    project: publicTickets,
    apply: async (tx, input) => {
      const fields = ticketRateFieldsSchema.strip().parse(input);
      const [row] = await tx
        .insert(ticketRates)
        .values({ ...fields, sortOrder: 0 })
        .returning();
      if (!row) throw new Error("No ticket inserted.");
      ticketIds.push(row.id);
      return {
        data: {
          ...row,
          createdAt: new Date(row.createdAt).toISOString(),
          updatedAt: new Date(row.updatedAt).toISOString(),
        },
        resourceId: row.id,
      };
    },
  };
  try {
    await renew();
    await run({
      service,
      db,
      userIds,
      time: () => time,
      advance: (ms) => {
        time += ms;
      },
      renew,
      createTicket,
      request: (
        input = { ...operations, expectedContentVersion: state.contentVersion },
        actor = 0,
      ) => ({
        input,
        method: "PUT",
        path: "/api/v1/admin/operations",
        key: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        token: tokens[actor],
        signal: new AbortController().signal,
      }),
    });
  } finally {
    await admin.delete(mutationReceipts).where(inArray(mutationReceipts.adminUserId, userIds));
    await admin.delete(auditEvents).where(inArray(auditEvents.actorId, userIds));
    // Operator audit has a null actor; remove fixture-targeted rows too.
    await admin.delete(auditEvents).where(inArray(auditEvents.resourceId, userIds));
    await admin.delete(adminSessions).where(inArray(adminSessions.adminUserId, userIds));
    await admin.delete(adminUsers).where(inArray(adminUsers.id, userIds));
    if (ticketIds.length) await admin.delete(ticketRates).where(inArray(ticketRates.id, ticketIds));
    await admin.update(siteState).set(state).where(eq(siteState.id, 1));
    await admin.update(operationsSettings).set(settings).where(eq(operationsSettings.id, 1));
  }
}
export function registerContentDatabaseTests(getConnections: () => Connections): void {
  test("T-08 niat privat/no-op menaikkan versi sekali, replay mempertahankan hasil asli, key berbeda payload ditolak", async () => {
    await withContent(getConnections(), async (f) => {
      const request = f.request();
      const [before] = await f.db.select().from(siteState);
      const first = await f.service.mutate(request, privateDefinition);
      expect(first.body.meta.contentVersion).toBe((before?.contentVersion ?? -1) + 1);
      expect(first.body.meta.publicUpdatedAt).toBe(new Date(before!.publicUpdatedAt).toISOString());
      expect(first.body.meta.ticketsUpdatedAt).toBe(before!.ticketsUpdatedAt);
      const retryId = crypto.randomUUID();
      const replay = await f.service.mutate(
        { ...request, requestId: retryId },
        {
          ...privateDefinition,
          apply: () => {
            throw new Error("Replay must not apply.");
          },
        },
      );
      expect(replay.body).toEqual({
        ...first.body,
        meta: {
          ...first.body.meta,
          requestId: retryId,
          idempotency: { ...first.body.meta.idempotency, replayed: true },
        },
      });
      expect((await f.service.lookup(request)).responseBody).toEqual(first.body);
      expect(
        await errorCode(
          f.service.mutate(
            { ...request, input: { ...operations, expectedContentVersion: 999 } },
            privateDefinition,
          ),
        ),
      ).toBe("IDEMPOTENCY_KEY_REUSED");
      const second = f.request({
        ...operations,
        monthlyBudgetIdr: 0,
        expectedContentVersion: first.body.meta.contentVersion,
      });
      const saved = await f.service.mutate(second, privateDefinition);
      expect(saved.body.meta.contentVersion).toBe(first.body.meta.contentVersion + 1);
      expect((await f.service.mutate(request, privateDefinition)).body.data).toEqual(operations);
      expect((await f.db.select().from(operationsSettings))[0]?.monthlyBudgetIdr).toBe(0);
      expect(
        await f.db.select().from(auditEvents).where(inArray(auditEvents.actorId, f.userIds)),
      ).toHaveLength(2);
      expect(
        await errorCode(f.service.lookup({ ...request, token: f.request(undefined, 1).token })),
      ).toBe("RECEIPT_NOT_FOUND");
    });
  });
  test("T-08 duplikasi serentak satu efek; dua akun dengan versi sama menghasilkan satu konflik", async () => {
    await withContent(getConnections(), async (f) => {
      const request = f.request();
      const pair = await Promise.all([
        f.service.mutate(request, privateDefinition),
        f.service.mutate({ ...request, requestId: crypto.randomUUID() }, privateDefinition),
      ]);
      expect(pair.map((r) => r.body.meta.idempotency.replayed).sort()).toEqual([false, true]);
      expect(
        await f.db
          .select()
          .from(mutationReceipts)
          .where(inArray(mutationReceipts.adminUserId, f.userIds)),
      ).toHaveLength(1);
      const input = { ...operations, expectedContentVersion: pair[0].body.meta.contentVersion };
      const results = await Promise.allSettled([
        f.service.mutate(f.request(input), privateDefinition),
        f.service.mutate(f.request(input, 1), privateDefinition),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      if (rejected?.status !== "rejected") throw new Error("Expected version conflict.");
      expect(rejected.reason).toMatchObject({ detail: { code: "CONTENT_VERSION_CONFLICT" } });
      expect((await f.db.select().from(siteState))[0]?.contentVersion).toBe(
        input.expectedContentVersion + 1,
      );
    });
  });
  test("T-08 create/delete replay, Location, tarif tersembunyi dan perubahan proyeksi publik", async () => {
    await withContent(getConnections(), async (f) => {
      const [state] = await f.db.select().from(siteState);
      const request = {
        ...f.request({
          name: "Contoh tarif — data uji",
          priceIdr: 0,
          unit: "per orang",
          terms: "Fixture",
          applicabilityNote: null,
          expectedContentVersion: state!.contentVersion,
        }),
        method: "POST",
        path: "/api/v1/admin/ticket-rates",
      };
      const hidden = await f.service.mutate(request, f.createTicket);
      expect(hidden.body.meta.publicUpdatedAt).toBe(new Date(state!.publicUpdatedAt).toISOString());
      const replay = await f.service.mutate(
        { ...request, input: { ...(request.input as object), isVisible: false } },
        f.createTicket,
      );
      expect(replay.location).toBe(hidden.location);
      expect(replay.body.meta.idempotency.replayed).toBe(true);
      const visible = await f.service.mutate(
        {
          ...request,
          key: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          input: {
            ...(request.input as object),
            isVisible: true,
            expectedContentVersion: hidden.body.meta.contentVersion,
          },
        },
        f.createTicket,
      );
      expect(visible.body.meta.publicUpdatedAt).toBe(new Date(f.time()).toISOString());
      expect(visible.body.meta.ticketsUpdatedAt).toBe(new Date(f.time()).toISOString());
      const id = visible.location!.split("/").at(-1)!;
      const deletion: MutationDefinition<{ expectedContentVersion: number }> = {
        schema: z.strictObject({ expectedContentVersion: contentVersionSchema }),
        project: publicTickets,
        apply: async (tx) => {
          const rows = await tx.delete(ticketRates).where(eq(ticketRates.id, id)).returning();
          if (!rows.length) throw failure("NOT_FOUND");
          return { data: { id, deleted: true }, resourceId: id };
        },
      };
      const deleteRequest = {
        ...f.request({ expectedContentVersion: visible.body.meta.contentVersion }),
        method: "DELETE",
        path: `/api/v1/admin/ticket-rates/${id}`,
      };
      f.advance(1000);
      const deleted = await f.service.mutate(deleteRequest, deletion);
      expect(deleted.body.meta.ticketsUpdatedAt).toBe(new Date(f.time()).toISOString());
      expect((await f.service.mutate(deleteRequest, deletion)).body.meta.idempotency.replayed).toBe(
        true,
      );
      expect(await f.db.select().from(ticketRates).where(eq(ticketRates.id, id))).toHaveLength(0);
    });
  });
  test("T-08 rollback setelah perubahan, hasil DTO invalid, pembatalan, sesi dicabut dan versi overflow", async () => {
    await withContent(getConnections(), async (f) => {
      const [before] = await f.db.select().from(siteState);
      for (const mode of ["throw", "invalid", "abort", "audit"] as const) {
        const controller = new AbortController();
        const request = { ...f.request(), signal: controller.signal };
        const definition = {
          ...privateDefinition,
          apply: async (tx: Database, input: z.output<typeof operationsRequestSchema>) => {
            const applied = await privateDefinition.apply(tx, { ...input, monthlyBudgetIdr: 123 });
            if (mode === "audit") return { ...applied, resourceId: "invalid-uuid-fixture" };
            if (mode === "throw") throw failure("INTERNAL_ERROR");
            if (mode === "abort") controller.abort();
            return { data: { invalid: true }, resourceId: null };
          },
        };
        expect(await errorCode(f.service.mutate(request, definition))).toBe(
          mode === "abort" || mode === "audit" ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
        );
        expect(
          await errorCode(f.service.lookup({ ...request, signal: new AbortController().signal })),
        ).toBe("RECEIPT_NOT_FOUND");
      }
      expect((await f.db.select().from(siteState))[0]).toEqual(before);
      expect((await f.db.select().from(operationsSettings))[0]?.monthlyBudgetIdr).toBeNull();
      expect(
        await f.db.select().from(auditEvents).where(inArray(auditEvents.actorId, f.userIds)),
      ).toHaveLength(0);
      await f.db
        .update(siteState)
        .set({ contentVersion: Number.MAX_SAFE_INTEGER })
        .where(eq(siteState.id, 1));
      expect(
        await errorCode(
          f.service.mutate(
            f.request({ ...operations, expectedContentVersion: Number.MAX_SAFE_INTEGER }),
            privateDefinition,
          ),
        ),
      ).toBe("INTERNAL_ERROR");
      const [user] = await f.db.select().from(adminUsers).where(eq(adminUsers.id, f.userIds[0]!));
      await manageAccount(getConnections().migration.db, { action: "disable", email: user!.email });
      expect(await errorCode(f.service.mutate(f.request(), privateDefinition))).toBe(
        "AUTH_REQUIRED",
      );
      expect(await errorCode(f.service.lookup(f.request()))).toBe("AUTH_REQUIRED");
    });
  });
  test("T-08 batas tunggu lock memberi 409 Retry-After dan tidak menyimpan receipt", async () => {
    await withContent(getConnections(), async (f) => {
      const request = f.request();
      await getConnections().migration.db.transaction(async (tx) => {
        await tx.select().from(siteState).where(eq(siteState.id, 1)).for("update");
        try {
          await f.service.mutate(request, privateDefinition);
          throw new Error("Expected lock contention.");
        } catch (error) {
          if (!(error instanceof HttpError)) throw error;
          expect(error.detail.code).toBe("OPERATION_IN_PROGRESS");
          expect(error.headers).toEqual({ "Retry-After": "2" });
        }
      });
      expect(await errorCode(f.service.lookup(request))).toBe("RECEIPT_NOT_FOUND");
      expect(
        (await f.service.mutate(request, privateDefinition)).body.meta.idempotency.replayed,
      ).toBe(false);
    });
  });
  test("T-08 sesi yang kedaluwarsa selama apply membatalkan perubahan sebelum commit", async () => {
    await withContent(getConnections(), async (f) => {
      const request = f.request();
      const [before] = await f.db.select().from(siteState);
      expect(
        await errorCode(
          f.service.mutate(request, {
            ...privateDefinition,
            apply: async (tx, input) => {
              const result = await privateDefinition.apply(tx, { ...input, monthlyBudgetIdr: 456 });
              f.advance(30 * 60 * 1000);
              return result;
            },
          }),
        ),
      ).toBe("AUTH_REQUIRED");
      expect((await f.db.select().from(siteState))[0]).toEqual(before);
      expect((await f.db.select().from(operationsSettings))[0]?.monthlyBudgetIdr).toBeNull();
      await f.renew();
      expect(await errorCode(f.service.lookup(request))).toBe("RECEIPT_NOT_FOUND");
    });
  });
  test("T-08 expiry 24 h, scope lookup, cleanup terbatas dan retensi tidak diperpanjang replay", async () => {
    await withContent(getConnections(), async (f) => {
      const request = f.request();
      const first = await f.service.mutate(request, privateDefinition);
      const expires = first.body.meta.idempotency.expiresAt;
      expect(Date.parse(expires) - f.time()).toBe(RECEIPT_RETENTION_MS);
      f.advance(RECEIPT_RETENTION_MS - 1);
      await f.renew();
      expect(
        (await f.service.mutate(request, privateDefinition)).body.meta.idempotency.expiresAt,
      ).toBe(expires);
      expect(await errorCode(f.service.lookup({ ...request, path: "/api/v1/admin/seo" }))).toBe(
        "RECEIPT_NOT_FOUND",
      );
      f.advance(1);
      expect(await errorCode(f.service.lookup(request))).toBe("RECEIPT_NOT_FOUND");
      expect(await errorCode(f.service.mutate(request, privateDefinition))).toBe(
        "CONTENT_VERSION_CONFLICT",
      );
      const second = f.request({
        ...operations,
        expectedContentVersion: first.body.meta.contentVersion,
      });
      await f.service.mutate(second, privateDefinition);
      expect(await cleanupReceipts(f.db, f.time())).toBe(1);
      expect((await f.service.lookup(second)).key).toBe(second.key);
      expect(
        await f.db
          .select()
          .from(mutationReceipts)
          .where(
            and(
              eq(mutationReceipts.adminUserId, f.userIds[0]!),
              eq(mutationReceipts.idempotencyKey, request.key),
            ),
          ),
      ).toHaveLength(0);
    });
  });
}
