import { SQL } from "bun";
import { and, eq, sql } from "drizzle-orm";
import type { ZodType } from "zod";
import { contentStateSchema } from "@umbul-nogo/contracts/envelopes";
import {
  mutationReceiptQuerySchema,
  mutationReceiptSchema,
} from "@umbul-nogo/contracts/mutation-receipts";
import type { MutationReceiptDto } from "@umbul-nogo/contracts/mutation-receipts";
import { operationKeySchema, uuidSchema } from "@umbul-nogo/contracts/primitives";
import type { Database } from "../db/client";
import { auditEvents, mutationReceipts, siteState } from "../db/schema";
import { authTimeouts } from "../auth/locks";
import { requireTransactionSession } from "../auth/transaction";
import { failure, HttpError } from "../http/errors";
import { parseInput } from "../http/transport";
import { canonicalJson, intentHash } from "./canonical";

export const RECEIPT_RETENTION_MS = 24 * 60 * 60 * 1000;
export type ReceiptRequest = {
  token: string | undefined;
  signal: AbortSignal;
  method: string;
  path: string;
  key: string;
};
export type MutationRequest = ReceiptRequest & { requestId: string; input: unknown };
export type MutationResult = {
  status: 200 | 201;
  body: MutationReceiptDto["responseBody"];
  location?: string;
};
export type MutationDefinition<Input extends { expectedContentVersion: number }> = {
  schema: ZodType<Input>;
  // These explicit projections exclude administrative metadata and hidden data.
  // Include all public fields affected by this operation, including SEO fallback.
  project: (tx: Database) => Promise<{ public: unknown; tickets: unknown }>;
  apply: (tx: Database, input: Input) => Promise<{ data: unknown; resourceId: string | null }>;
};
function scopeWhere(userId: string, request: ReceiptRequest) {
  return and(
    eq(mutationReceipts.adminUserId, userId),
    eq(mutationReceipts.method, request.method as MutationReceiptDto["method"]),
    eq(mutationReceipts.route, request.path),
    eq(mutationReceipts.idempotencyKey, request.key),
  );
}
function validateScope(request: ReceiptRequest): void {
  parseInput(mutationReceiptQuerySchema, { method: request.method, path: request.path });
  parseInput(operationKeySchema, request.key);
}
function receiptDto(row: typeof mutationReceipts.$inferSelect): MutationReceiptDto {
  const result = mutationReceiptSchema.safeParse({
    key: row.idempotencyKey,
    method: row.method,
    path: row.route,
    expiresAt: new Date(row.expiresAt).toISOString(),
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
  });
  if (!result.success) throw failure("INTERNAL_ERROR");
  return result.data;
}
function mutationResult(
  receipt: MutationReceiptDto,
  requestId: string,
  replayed: boolean,
): MutationResult {
  const original = receipt.responseBody;
  return {
    status: receipt.responseStatus,
    body: {
      ...original,
      meta: {
        ...original.meta,
        requestId,
        idempotency: { ...original.meta.idempotency, replayed },
      },
    },
    ...(receipt.method === "POST" && "id" in original.data
      ? { location: `${receipt.path}/${original.data.id}` }
      : {}),
  };
}
async function databaseOperation<T>(action: () => Promise<T>, mutation = false): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    let cause = error;
    while (cause instanceof Error && cause.cause) cause = cause.cause;
    if (mutation && cause instanceof SQL.PostgresError && (cause.errno ?? cause.code) === "55P03")
      throw new HttpError(
        {
          code: "OPERATION_IN_PROGRESS",
          message:
            "Operasi masih menunggu transaksi lain. Periksa receipt sebelum mencoba kembali.",
        },
        { "Retry-After": "2" },
      );
    throw failure("SERVICE_UNAVAILABLE");
  }
}
export function createContentService({ db, now = Date.now }: { db: Database; now?: () => number }) {
  return {
    async mutate<Input extends { expectedContentVersion: number }>(
      request: MutationRequest,
      definition: MutationDefinition<Input>,
    ): Promise<MutationResult> {
      return databaseOperation(
        () =>
          db.transaction(async (tx) => {
            await authTimeouts(tx);
            const userId = await requireTransactionSession(tx, request.token, now, request.signal);
            validateScope(request);
            parseInput(uuidSchema, request.requestId);
            const input = parseInput(definition.schema, request.input);
            const hash = intentHash(input);
            // All content writers take account -> singleton locks. Re-read receipt
            // under the global lock before version/existence checks for concurrent retries.
            const [row] = await tx
              .select()
              .from(siteState)
              .where(eq(siteState.id, 1))
              .for("update");
            if (!row) throw failure("INTERNAL_ERROR");
            const [existing] = await tx
              .select()
              .from(mutationReceipts)
              .where(scopeWhere(userId, request));
            if (existing && Date.parse(existing.expiresAt) > now()) {
              if (existing.requestHash !== hash) throw failure("IDEMPOTENCY_KEY_REUSED");
              await requireTransactionSession(tx, request.token, now, request.signal);
              return mutationResult(receiptDto(existing), request.requestId, true);
            }
            if (existing)
              await tx.delete(mutationReceipts).where(eq(mutationReceipts.id, existing.id));
            if (row.contentVersion !== input.expectedContentVersion)
              throw new HttpError({
                code: "CONTENT_VERSION_CONFLICT",
                message: "Konten sudah berubah. Muat data terbaru sebelum menyimpan kembali.",
                details: {
                  expectedContentVersion: input.expectedContentVersion,
                  currentContentVersion: row.contentVersion,
                },
              });
            if (row.contentVersion >= Number.MAX_SAFE_INTEGER) throw failure("INTERNAL_ERROR");
            request.signal.throwIfAborted();
            const before = await definition.project(tx);
            // Capture before apply: callbacks may reuse mutable objects.
            const beforePublic = canonicalJson(before.public);
            const beforeTickets = canonicalJson(before.tickets);
            const result = await definition.apply(tx, input);
            const after = await definition.project(tx);
            const ticketsChanged = beforeTickets !== canonicalJson(after.tickets);
            const publicChanged = ticketsChanged || beforePublic !== canonicalJson(after.public);
            await requireTransactionSession(tx, request.token, now, request.signal);
            const finalizedAt = now();
            const createdAt = new Date(finalizedAt).toISOString();
            const expiresAt = new Date(finalizedAt + RECEIPT_RETENTION_MS).toISOString();
            const state = contentStateSchema.parse({
              contentVersion: row.contentVersion + 1,
              publicUpdatedAt: publicChanged
                ? new Date(Math.max(finalizedAt, Date.parse(row.publicUpdatedAt))).toISOString()
                : new Date(row.publicUpdatedAt).toISOString(),
              ticketsUpdatedAt: ticketsChanged
                ? new Date(
                    Math.max(
                      finalizedAt,
                      row.ticketsUpdatedAt ? Date.parse(row.ticketsUpdatedAt) : 0,
                    ),
                  ).toISOString()
                : row.ticketsUpdatedAt
                  ? new Date(row.ticketsUpdatedAt).toISOString()
                  : null,
            });
            const parsed = mutationReceiptSchema.safeParse({
              key: request.key,
              method: request.method,
              path: request.path,
              expiresAt,
              responseStatus: request.method === "POST" ? 201 : 200,
              responseBody: {
                success: true,
                data: result.data,
                meta: {
                  requestId: request.requestId,
                  ...state,
                  idempotency: {
                    key: request.key,
                    replayed: false,
                    originalRequestId: request.requestId,
                    expiresAt,
                  },
                },
              },
            });
            if (!parsed.success) throw failure("INTERNAL_ERROR");
            const receipt = parsed.data;
            await tx.update(siteState).set(state).where(eq(siteState.id, 1));
            const resourceType = request.path.split("/")[4];
            if (!resourceType) throw failure("INTERNAL_ERROR");
            await tx.insert(auditEvents).values({
              actorId: userId,
              action: `content.${request.method.toLowerCase()}`,
              resourceType,
              resourceId: result.resourceId,
              requestId: request.requestId,
              createdAt,
            });
            await tx.insert(mutationReceipts).values({
              adminUserId: userId,
              method: receipt.method,
              route: request.path,
              idempotencyKey: request.key,
              requestHash: hash,
              responseStatus: receipt.responseStatus,
              responseBody: receipt.responseBody,
              createdAt,
              expiresAt,
            });
            await requireTransactionSession(tx, request.token, now, request.signal);
            return mutationResult(receipt, request.requestId, false);
          }),
        true,
      );
    },
    async lookup(request: ReceiptRequest): Promise<MutationReceiptDto> {
      return databaseOperation(() =>
        db.transaction(async (tx) => {
          await authTimeouts(tx);
          const userId = await requireTransactionSession(tx, request.token, now, request.signal);
          validateScope(request);
          const [row] = await tx.select().from(mutationReceipts).where(scopeWhere(userId, request));
          request.signal.throwIfAborted();
          if (!row || Date.parse(row.expiresAt) <= now()) throw failure("RECEIPT_NOT_FOUND");
          return receiptDto(row);
        }),
      );
    },
  };
}
export type ContentService = ReturnType<typeof createContentService>;

export async function cleanupReceipts(db: Database, time = Date.now()): Promise<number> {
  return databaseOperation(() =>
    db.transaction(async (tx) => {
      await authTimeouts(tx);
      const rows = await tx.execute(
        sql`WITH expired AS (SELECT id FROM mutation_receipts WHERE expires_at <= ${new Date(time).toISOString()}::timestamptz ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED) DELETE FROM mutation_receipts USING expired WHERE mutation_receipts.id = expired.id RETURNING mutation_receipts.id`,
      );
      return rows.length;
    }),
  );
}
