import { expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { apiFailureSchema } from "@umbul-nogo/contracts/errors";
import {
  ticketRateListResponseSchema,
  ticketRateResponseSchema,
  ticketRateMutationResponseSchema,
} from "@umbul-nogo/contracts/ticket-rates";
import { deleteContentResponseSchema, orderResponseSchema } from "@umbul-nogo/contracts/envelopes";
import { mutationReceiptResponseSchema } from "@umbul-nogo/contracts/mutation-receipts";
import type { createDatabase } from "../src/db/client";
import {
  adminUsers,
  adminSessions,
  auditEvents,
  mutationReceipts,
  siteState,
  ticketRates,
} from "../src/db/schema";
import { createAuthService } from "../src/auth/service";
import { createAuthHttp } from "../src/auth/http";
import { hashPassword, newSessionToken, sha256 } from "../src/auth/crypto";
import { createContentHttp } from "../src/content/http";
import { createContentService } from "../src/content/service";
import { createTicketRateHttp } from "../src/ticket-rates/http";
import { createTicketRateService, TICKET_PATH } from "../src/ticket-rates/service";
import { createApp } from "../src/app";
import type { RequestLog } from "../src/http/transport";

type Connections = {
  migration: ReturnType<typeof createDatabase>;
  runtime: ReturnType<typeof createDatabase>;
};
const origin = "https://example.test";
const fields = {
  name: "Contoh tarif — data uji",
  priceIdr: 0,
  unit: "per orang",
  terms: "Ketentuan fixture privat",
  applicabilityNote: null,
  isVisible: false,
};
async function withTickets(
  connections: Connections,
  run: (f: {
    send: (method: string, path: string, body?: unknown, key?: string) => Promise<Response>;
    app: ReturnType<typeof createApp>;
    headers: Record<string, string>;
    logs: RequestLog[];
    version: number;
    advance: () => void;
    userId: string;
  }) => Promise<void>,
) {
  const db = connections.migration.db;
  const [state] = await db.select().from(siteState);
  if (!state || (await db.select().from(ticketRates)).length)
    throw new Error("Fixture memerlukan daftar tarif kosong.");
  let time = Date.parse("2031-01-01T00:00:00Z");
  const token = newSessionToken();
  const [user] = await db
    .insert(adminUsers)
    .values({
      email: `ticket-${crypto.randomUUID()}@example.test`,
      passwordHash: await hashPassword("Ticket fixture password only"),
    })
    .returning();
  if (!user) throw new Error("Missing fixture account.");
  const headers = {
    origin,
    "x-umbul-client": "admin-web",
    cookie: `__Host-umbul_session=${token}`,
    "content-type": "application/json",
  };
  try {
    await db.insert(adminSessions).values({
      adminUserId: user.id,
      tokenHash: sha256(token),
      createdAt: new Date(time).toISOString(),
      lastSeenAt: new Date(time).toISOString(),
      expiresAt: new Date(time + 8 * 60 * 60 * 1000).toISOString(),
    });
    const auth = createAuthHttp({
      service: createAuthService({
        db: connections.runtime.db,
        now: () => time,
        verifyPassword: (password, hash) =>
          hash ? Bun.password.verify(password, hash) : Promise.resolve(false),
      }),
      siteOrigin: origin,
      production: true,
      sourceAddress: () => "127.0.0.1",
    });
    const logs: RequestLog[] = [];
    const app = createApp({
      ...auth,
      readProfile: () => Promise.resolve({ name: "UMBUL NOGO", region: "Wonogiri" }),
      ready: () => Promise.resolve(true),
      log: (entry) => logs.push(entry),
      routes: [
        ...auth.routes,
        ...createContentHttp({
          service: createContentService({ db: connections.runtime.db, now: () => time }),
          production: true,
        }),
        ...createTicketRateHttp({
          service: createTicketRateService({ db: connections.runtime.db, now: () => time }),
          production: true,
        }),
      ],
    });
    await run({
      app,
      headers,
      logs,
      version: state.contentVersion,
      userId: user.id,
      advance: () => {
        time += 1000;
      },
      send: (method, path, body, key = crypto.randomUUID()) =>
        app.handle(
          new Request(origin + path, {
            method,
            headers: { ...headers, "idempotency-key": key },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        ),
    });
  } finally {
    // This suite requires an empty, isolated test database and executes serially.
    const created = await db.select({ id: ticketRates.id }).from(ticketRates);
    if (created.length)
      await db.delete(ticketRates).where(
        inArray(
          ticketRates.id,
          created.map((row) => row.id),
        ),
      );
    await db.delete(mutationReceipts).where(eq(mutationReceipts.adminUserId, user.id));
    await db.delete(auditEvents).where(eq(auditEvents.actorId, user.id));
    await db.delete(adminSessions).where(eq(adminSessions.adminUserId, user.id));
    await db.delete(adminUsers).where(eq(adminUsers.id, user.id));
    await db.update(siteState).set(state).where(eq(siteState.id, 1));
  }
}
async function code(response: Response) {
  return apiFailureSchema.parse(await response.json()).error.code;
}
async function saved(response: Response) {
  expect([200, 201]).toContain(response.status);
  return ticketRateMutationResponseSchema.parse(await response.json());
}
export function registerTicketRateDatabaseTests(getConnections: () => Connections): void {
  test("T-09 HTTP create/reload/edit/hide/show/reorder/delete, proyeksi dan replay", async () => {
    await withTickets(getConnections(), async (f) => {
      const empty = ticketRateListResponseSchema.parse(
        await (await f.send("GET", TICKET_PATH)).json(),
      );
      expect(empty.data.items).toEqual([]);
      const key = crypto.randomUUID();
      const input = { ...fields, expectedContentVersion: f.version };
      const defaultInput: Record<string, unknown> = { ...input };
      delete defaultInput.isVisible;
      const response = await f.send("POST", TICKET_PATH, defaultInput, key);
      expect(response.status).toBe(201);
      const first = await saved(response);
      expect(first.data).toMatchObject({ priceIdr: 0, isVisible: false, sortOrder: 0 });
      expect(response.headers.get("location")).toBe(`${TICKET_PATH}/${first.data.id}`);
      expect(first.meta.publicUpdatedAt).toBe(empty.meta.publicUpdatedAt);
      const retry = await f.send("POST", TICKET_PATH, input, key);
      expect(retry.headers.get("location")).toBe(response.headers.get("location"));
      expect((await saved(retry)).meta.idempotency.replayed).toBe(true);
      expect(
        ticketRateListResponseSchema.parse(await (await f.send("GET", TICKET_PATH)).json()).data
          .items,
      ).toHaveLength(1);
      f.advance();
      const second = await saved(
        await f.send("POST", TICKET_PATH, {
          ...fields,
          name: "Tarif tampil",
          isVisible: true,
          expectedContentVersion: first.meta.contentVersion,
        }),
      );
      expect(second.data.sortOrder).toBe(1);
      expect(second.meta.ticketsUpdatedAt).not.toBe(first.meta.ticketsUpdatedAt);
      f.advance();
      const reordered = orderResponseSchema.parse(
        await (
          await f.send("PUT", `${TICKET_PATH}/order`, {
            ids: [second.data.id, first.data.id],
            expectedContentVersion: second.meta.contentVersion,
          })
        ).json(),
      );
      expect(reordered.meta.ticketsUpdatedAt).toBe(second.meta.ticketsUpdatedAt);
      const list = ticketRateListResponseSchema.parse(
        await (await f.send("GET", TICKET_PATH)).json(),
      );
      expect(list.data.items.map((row) => [row.id, row.sortOrder])).toEqual([
        [second.data.id, 0],
        [first.data.id, 1],
      ]);
      expect(list.data.items[0]?.updatedAt).toBe(second.data.updatedAt);
      f.advance();
      const edited = await saved(
        await f.send("PUT", `${TICKET_PATH}/${first.data.id}`, {
          ...fields,
          priceIdr: 12500,
          terms: "Ketentuan diperbarui atomik",
          isVisible: true,
          expectedContentVersion: reordered.meta.contentVersion,
        }),
      );
      const detail = ticketRateResponseSchema.parse(
        await (await f.send("GET", `${TICKET_PATH}/${first.data.id}`)).json(),
      );
      expect(detail.data).toEqual(edited.data);
      expect(detail.meta.contentVersion).toBe(edited.meta.contentVersion);
      const [stored] = await getConnections()
        .runtime.db.select()
        .from(ticketRates)
        .where(eq(ticketRates.id, first.data.id));
      expect(stored).toMatchObject({ priceIdr: 12500, terms: "Ketentuan diperbarui atomik" });
      f.advance();
      const noOp = await saved(
        await f.send("PUT", `${TICKET_PATH}/${first.data.id}`, {
          ...fields,
          priceIdr: 12500,
          terms: "Ketentuan diperbarui atomik",
          isVisible: true,
          expectedContentVersion: edited.meta.contentVersion,
        }),
      );
      expect(noOp.meta.contentVersion).toBe(edited.meta.contentVersion + 1);
      expect(noOp.meta.publicUpdatedAt).toBe(edited.meta.publicUpdatedAt);
      expect(noOp.meta.ticketsUpdatedAt).toBe(edited.meta.ticketsUpdatedAt);
      f.advance();
      const publicOrder = orderResponseSchema.parse(
        await (
          await f.send("PUT", `${TICKET_PATH}/order`, {
            ids: [first.data.id, second.data.id],
            expectedContentVersion: noOp.meta.contentVersion,
          })
        ).json(),
      );
      expect(publicOrder.meta.ticketsUpdatedAt).not.toBe(edited.meta.ticketsUpdatedAt);
      f.advance();
      const hidden = await saved(
        await f.send("PUT", `${TICKET_PATH}/${second.data.id}`, {
          ...fields,
          name: "Tarif tampil",
          expectedContentVersion: publicOrder.meta.contentVersion,
        }),
      );
      expect(hidden.meta.ticketsUpdatedAt).not.toBe(publicOrder.meta.ticketsUpdatedAt);
      const deleteKey = crypto.randomUUID();
      const deletePath = `${TICKET_PATH}/${first.data.id}?expectedContentVersion=${hidden.meta.contentVersion}`;
      f.advance();
      const deleted = deleteContentResponseSchema.parse(
        await (await f.send("DELETE", deletePath, undefined, deleteKey)).json(),
      );
      expect(deleted.data).toEqual({ id: first.data.id, deleted: true });
      expect(deleted.meta.ticketsUpdatedAt).not.toBe(hidden.meta.ticketsUpdatedAt);
      const replayDelete = deleteContentResponseSchema.parse(
        await (await f.send("DELETE", deletePath, undefined, deleteKey)).json(),
      );
      expect(replayDelete.meta.idempotency.replayed).toBe(true);
      expect(replayDelete.meta.contentVersion).toBe(deleted.meta.contentVersion);
      const receiptPath = `/api/v1/admin/mutation-receipts/${deleteKey}?method=DELETE&path=${encodeURIComponent(`${TICKET_PATH}/${first.data.id}`)}`;
      expect(
        mutationReceiptResponseSchema.parse(await (await f.send("GET", receiptPath)).json()).data
          .responseBody,
      ).toEqual(deleted);
      expect((await f.send("GET", `${TICKET_PATH}/${first.data.id}`)).status).toBe(404);
      const remaining = ticketRateListResponseSchema.parse(
        await (await f.send("GET", TICKET_PATH)).json(),
      );
      expect(remaining.data.items.map((row) => [row.id, row.sortOrder])).toEqual([
        [second.data.id, 0],
      ]);
      f.advance();
      const deleteHidden = deleteContentResponseSchema.parse(
        await (
          await f.send(
            "DELETE",
            `${TICKET_PATH}/${second.data.id}?expectedContentVersion=${deleted.meta.contentVersion}`,
          )
        ).json(),
      );
      expect(deleteHidden.meta.ticketsUpdatedAt).toBe(deleted.meta.ticketsUpdatedAt);
      const emptyOrder = await f.send("PUT", `${TICKET_PATH}/order`, {
        ids: [],
        expectedContentVersion: deleteHidden.meta.contentVersion,
      });
      expect(emptyOrder.status).toBe(200);
      expect(JSON.stringify(f.logs)).not.toContain("Ketentuan");
    });
  });
  test("T-09 input invalid, konflik sebelum membership/existence dan akses privat", async () => {
    await withTickets(getConnections(), async (f) => {
      const input = { ...fields, expectedContentVersion: f.version };
      for (const priceIdr of [-1, 0.5, "0", "", null, 2_147_483_648]) {
        const response = await f.send("POST", TICKET_PATH, { ...input, priceIdr });
        expect(response.status).toBe(422);
        expect(await code(response)).toBe("VALIDATION_ERROR");
      }
      for (const invalid of [
        { ...input, terms: " " },
        { ...input, sortOrder: 0 },
        { ...input, applicabilityNote: " " },
      ])
        expect((await f.send("POST", TICKET_PATH, invalid)).status).toBe(422);
      expect((await f.send("POST", TICKET_PATH, input, "invalid-key")).status).toBe(422);
      expect((await getConnections().runtime.db.select().from(siteState))[0]?.contentVersion).toBe(
        f.version,
      );
      const first = await saved(await f.send("POST", TICKET_PATH, input));
      expect(
        (
          await f.send("PUT", `${TICKET_PATH}/${first.data.id}`, {
            ...fields,
            priceIdr: 999,
            terms: " ",
            expectedContentVersion: first.meta.contentVersion,
          })
        ).status,
      ).toBe(422);
      expect(
        ticketRateResponseSchema.parse(
          await (await f.send("GET", `${TICKET_PATH}/${first.data.id}`)).json(),
        ).data,
      ).toEqual(first.data);
      for (const ids of [[], [first.data.id, first.data.id], [crypto.randomUUID()]]) {
        const response = await f.send("PUT", `${TICKET_PATH}/order`, {
          ids,
          expectedContentVersion: first.meta.contentVersion,
        });
        expect(await code(response)).toBe("INVALID_ORDER");
      }
      expect(
        await code(
          await f.send("PUT", `${TICKET_PATH}/order`, {
            ids: [],
            expectedContentVersion: f.version,
          }),
        ),
      ).toBe("CONTENT_VERSION_CONFLICT");
      const missing = `${TICKET_PATH}/${crypto.randomUUID()}`;
      expect(await code(await f.send("PUT", missing, input))).toBe("CONTENT_VERSION_CONFLICT");
      expect(
        await code(
          await f.send("PUT", missing, {
            ...input,
            expectedContentVersion: first.meta.contentVersion,
          }),
        ),
      ).toBe("NOT_FOUND");
      for (const version of ["01", "-1", "1.2", "", "9007199254740992"])
        expect(
          (
            await f.send(
              "DELETE",
              `${TICKET_PATH}/${first.data.id}?expectedContentVersion=${version}`,
            )
          ).status,
        ).toBe(422);
      expect(
        (
          await f.send(
            "DELETE",
            `${TICKET_PATH}/${first.data.id}?expectedContentVersion=${first.meta.contentVersion}`,
            {},
          )
        ).status,
      ).toBe(413);
      expect((await f.send("GET", `${TICKET_PATH}?filter=visible`)).status).toBe(400);
      expect((await f.send("GET", `${TICKET_PATH}/not-a-uuid`)).status).toBe(422);
      expect((await f.send("GET", `${TICKET_PATH}/order`)).status).toBe(405);
      const noSession = await f.app.handle(
        new Request(origin + TICKET_PATH, { headers: { "x-umbul-client": "admin-web" } }),
      );
      expect(noSession.status).toBe(401);
      const foreignOrigin = await f.app.handle(
        new Request(origin + TICKET_PATH, {
          method: "POST",
          headers: { ...f.headers, origin: "https://foreign.test" },
          body: "invalid json",
        }),
      );
      expect(await code(foreignOrigin)).toBe("ORIGIN_NOT_ALLOWED");
      const listResponse = await f.send("GET", TICKET_PATH);
      expect(listResponse.headers.get("cache-control")).toBe("private, no-store");
      expect(ticketRateListResponseSchema.parse(await listResponse.json()).data.items).toHaveLength(
        1,
      );
      expect(
        await getConnections()
          .runtime.db.select()
          .from(auditEvents)
          .where(eq(auditEvents.actorId, f.userId)),
      ).toHaveLength(1);
    });
  });
  test("T-09 create serentak dengan key sama tidak menggandakan tarif atau versi", async () => {
    await withTickets(getConnections(), async (f) => {
      const key = crypto.randomUUID();
      const input = { ...fields, expectedContentVersion: f.version };
      const results = await Promise.all([
        f.send("POST", TICKET_PATH, input, key).then(saved),
        f.send("POST", TICKET_PATH, input, key).then(saved),
      ]);
      expect(results[0].data.id).toBe(results[1].data.id);
      expect(results.map((r) => r.meta.idempotency.replayed).sort()).toEqual([false, true]);
      expect(await code(await f.send("POST", TICKET_PATH, { ...input, priceIdr: 1 }, key))).toBe(
        "IDEMPOTENCY_KEY_REUSED",
      );
      expect((await getConnections().runtime.db.select().from(siteState))[0]?.contentVersion).toBe(
        f.version + 1,
      );
      expect(await getConnections().runtime.db.select().from(ticketRates)).toHaveLength(1);
    });
  });
}
