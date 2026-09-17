import { eq, sql } from "drizzle-orm";
import { bootstrapSiteSchema } from "@umbul-nogo/contracts/bootstrap";
import type { Database } from "./client";
import * as tables from "./schema";
import { failure } from "../http/errors";

const requiredTables = [
  tables.adminUsers,
  tables.adminSessions,
  tables.attractions,
  tables.auditEvents,
  tables.authThrottles,
  tables.contactChannels,
  tables.facilities,
  tables.galleryItems,
  tables.mediaAssets,
  tables.mutationReceipts,
  tables.openingHours,
  tables.operationsSettings,
  tables.siteProfile,
  tables.siteState,
  tables.ticketRates,
];
export function databaseServices(db: Database) {
  return {
    async readProfile(signal: AbortSignal) {
      let rows;
      try {
        rows = await db.transaction(
          async (tx) => {
            await tx.execute(sql`set local statement_timeout = '2s'`);
            signal.throwIfAborted();
            return tx
              .select({ name: tables.siteProfile.name, region: tables.siteProfile.region })
              .from(tables.siteProfile)
              .where(eq(tables.siteProfile.id, 1));
          },
          { accessMode: "read only" },
        );
      } catch {
        throw failure("SERVICE_UNAVAILABLE");
      }
      signal.throwIfAborted();
      const parsed = bootstrapSiteSchema.safeParse(rows[0]);
      if (!parsed.success) throw failure("INTERNAL_ERROR");
      return parsed.data;
    },
    async ready(signal: AbortSignal): Promise<boolean> {
      return db.transaction(
        async (tx) => {
          await tx.execute(sql`set local statement_timeout = '500ms'`);
          for (const table of requiredTables) {
            signal.throwIfAborted();
            // Compile/select every expected column without exposing a row. This
            // verifies the read-compatible schema without granting journal access.
            await tx.select().from(table).limit(0);
          }
          const profile = await tx.select({ id: tables.siteProfile.id }).from(tables.siteProfile);
          const state = await tx.select({ id: tables.siteState.id }).from(tables.siteState);
          const operations = await tx
            .select({ id: tables.operationsSettings.id })
            .from(tables.operationsSettings);
          const days = await tx
            .select({ weekday: tables.openingHours.weekday })
            .from(tables.openingHours);
          signal.throwIfAborted();
          return (
            profile.length === 1 &&
            profile[0]?.id === 1 &&
            state.length === 1 &&
            state[0]?.id === 1 &&
            operations.length === 1 &&
            operations[0]?.id === 1 &&
            days.length === 7 &&
            new Set(days.map((day) => day.weekday)).size === 7 &&
            days.every((day) => day.weekday >= 1 && day.weekday <= 7)
          );
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },
  };
}
