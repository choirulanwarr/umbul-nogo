import { registerAuthDatabaseTests } from "./auth-database-cases";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { eq, sql } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import type { Database } from "../src/db/client";
import { databaseServices } from "../src/db/health";
import { migrateDatabase } from "../src/db/migrate";
import { assertLocalDatabase, localDatabaseUrl } from "../src/db/local-target";
import { insertDevelopmentFixture } from "../src/db/fixture";
import {
  adminUsers,
  attractions,
  contactChannels,
  facilities,
  galleryItems,
  mediaAssets,
  openingHours,
  operationsSettings,
  siteProfile,
  siteState,
  ticketRates,
} from "../src/db/schema";

let migration: ReturnType<typeof createDatabase> | undefined;
let runtime: ReturnType<typeof createDatabase> | undefined;
function connections() {
  if (!migration || !runtime) throw new Error("Database test belum disiapkan.");
  return { migration, runtime };
}
class TestRollback extends Error {}
async function rollback(db: Database, action: (tx: Database) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await action(tx);
      throw new TestRollback();
    });
  } catch (error) {
    if (!(error instanceof TestRollback)) throw error;
  }
}

async function sqlFailure(action: Promise<void>, states: string[]): Promise<void> {
  let failure: unknown;
  try {
    await action;
  } catch (error) {
    failure = error;
  }
  while (failure instanceof Error && failure.cause) failure = failure.cause;
  expect(failure).toBeInstanceOf(SQL.PostgresError);
  if (!(failure instanceof SQL.PostgresError)) throw new Error("Expected PostgreSQL failure.");
  expect(states).toContain(failure.errno ?? failure.code);
}

beforeAll(async () => {
  if (process.env.ALLOW_DATABASE_TESTS !== "umbul_nogo_test")
    throw new Error("Tes database belum diaktifkan secara eksplisit.");
  const migrationUrl = localDatabaseUrl(
    process.env.TEST_MIGRATION_DATABASE_URL,
    "umbul_nogo_test",
    "umbul_migrator",
  );
  const runtimeUrl = localDatabaseUrl(
    process.env.TEST_DATABASE_URL,
    "umbul_nogo_test",
    "umbul_runtime",
  );
  migration = createDatabase(migrationUrl, "umbul_migrator");
  runtime = createDatabase(runtimeUrl);
  await assertLocalDatabase(migration.db, "umbul_nogo_test");
  await assertLocalDatabase(runtime.db, "umbul_nogo_test", "umbul_runtime");
  // This suite does not DROP/TRUNCATE or auto-clean a pre-existing database.
  const existing = await migration.db.execute<{ count: string }>(
    sql`select count(*)::text as count from pg_tables where schemaname in ('public','drizzle')`,
  );
  if (existing[0]?.count !== "0")
    throw new Error("Suite memerlukan database test kosong; tidak ada cleanup otomatis.");
  await migrateDatabase(migration.db);
}, 30_000);
afterAll(async () => {
  await runtime?.close();
  await migration?.close();
});

describe("T-04 PostgreSQL nyata", () => {
  test("migrasi membuat 15 tabel dan bootstrap kosong yang sah", async () => {
    const { db } = connections().migration;
    const tables = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from pg_tables where schemaname = 'public'`,
    );
    expect(tables[0]?.count).toBe("15");
    const [profile] = await db.select().from(siteProfile);
    expect(profile).toEqual({
      id: 1,
      name: "UMBUL NOGO",
      introduction: null,
      region: "Wonogiri, Jawa Tengah",
      address: null,
      latitude: null,
      longitude: null,
      mapUrl: null,
      visitNotes: null,
      heroMediaId: null,
      heroAlt: null,
      logoMediaId: null,
      seoTitle: null,
      seoDescription: null,
      seoMediaId: null,
    });
    const [state] = await db.select().from(siteState);
    expect(state?.contentVersion).toBe(0);
    expect(state?.ticketsUpdatedAt).toBeNull();
    expect(Number.isFinite(Date.parse(state?.publicUpdatedAt ?? ""))).toBe(true);
    expect(await db.select().from(operationsSettings)).toEqual([
      {
        id: 1,
        monthlyBudgetIdr: null,
        destinationManagerName: null,
        destinationManagerPhone: null,
        destinationManagerEmail: null,
        technicalOperatorName: null,
        technicalOperatorPhone: null,
        technicalOperatorEmail: null,
        internalNotes: null,
      },
    ]);
    expect(await db.select().from(openingHours).orderBy(openingHours.weekday)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        status: "unknown",
        opensAt: null,
        closesAt: null,
        closesNextDay: false,
      })),
    );
    for (const table of [
      ticketRates,
      attractions,
      facilities,
      galleryItems,
      contactChannels,
      mediaAssets,
      adminUsers,
    ])
      expect(await db.select().from(table)).toEqual([]);
  });
  test("readiness runtime membaca schema dan bootstrap tanpa izin journal", async () => {
    const { db } = connections().runtime;
    const services = databaseServices(db);
    const signal = new AbortController().signal;
    expect(await services.ready(signal)).toBe(true);
    expect(await services.readProfile(signal)).toEqual({
      name: "UMBUL NOGO",
      region: "Wonogiri, Jawa Tengah",
    });
  });
  test("readiness menolak schema yang kehilangan kolom wajib", async () => {
    const { db } = connections().migration;
    await sqlFailure(
      rollback(db, async (tx) => {
        await tx.execute(sql`ALTER TABLE site_profile DROP COLUMN region`);
        await databaseServices(tx).ready(new AbortController().signal);
      }),
      ["42703"],
    );
  });
  test("rerun migrasi tidak menimpa profil dan Operasional yang diedit", async () => {
    const { db } = connections().migration;
    await rollback(db, async (tx) => {
      await tx.update(siteProfile).set({ name: "Nama edit — data uji" });
      await tx.update(operationsSettings).set({ monthlyBudgetIdr: 0 });
      await migrateDatabase(tx);
      expect((await tx.select().from(siteProfile))[0]?.name).toBe("Nama edit — data uji");
      expect((await tx.select().from(operationsSettings))[0]?.monthlyBudgetIdr).toBe(0);
    });
  });
  test("commit terlihat koneksi lain dan rollback membatalkan seluruh perubahan", async () => {
    const { migration, runtime } = connections();
    const id = "90f7a944-6a71-4dd9-86bd-1d2fe70ca834";
    try {
      await runtime.db.transaction(async (tx) => {
        await tx.insert(facilities).values({ id, name: "Commit — data uji", sortOrder: 0 });
      });
      expect(
        (await migration.db.select().from(facilities).where(eq(facilities.id, id)))[0]?.name,
      ).toBe("Commit — data uji");
      await rollback(runtime.db, async (tx) => {
        await tx
          .update(facilities)
          .set({ name: "Rollback — data uji" })
          .where(eq(facilities.id, id));
        await tx.update(operationsSettings).set({ monthlyBudgetIdr: 100 });
      });
      expect(
        (await migration.db.select().from(facilities).where(eq(facilities.id, id)))[0]?.name,
      ).toBe("Commit — data uji");
      expect(
        (await migration.db.select().from(operationsSettings))[0]?.monthlyBudgetIdr,
      ).toBeNull();
    } finally {
      await runtime.db.delete(facilities).where(eq(facilities.id, id));
    }
  });
  test("runtime bukan owner, tidak punya CREATE/TEMP/TRUNCATE atau akses journal", async () => {
    const { db } = connections().runtime;
    const [permissions] = await db.execute<{
      role: string;
      superuser: boolean;
      create_db: boolean;
      create_schema: boolean;
      temp: boolean;
      truncate: boolean;
    }>(
      sql`select current_user as role, (select rolsuper from pg_roles where rolname = current_user) as superuser, has_database_privilege(current_database(), 'CREATE') as create_db, has_schema_privilege('public', 'CREATE') as create_schema, has_database_privilege(current_database(), 'TEMP') as temp, has_table_privilege('ticket_rates', 'TRUNCATE') as truncate`,
    );
    expect(permissions).toEqual({
      role: "umbul_runtime",
      superuser: false,
      create_db: false,
      create_schema: false,
      temp: false,
      truncate: false,
    });
    for (const statement of [
      sql`create table public.forbidden_test (id integer)`,
      sql`create schema forbidden_test`,
      sql`create temporary table forbidden_test (id integer)`,
      sql`select * from drizzle.__drizzle_migrations`,
      sql`delete from site_profile`,
      sql`delete from opening_hours`,
    ]) {
      await sqlFailure(
        rollback(db, async (tx) => {
          await tx.execute(statement);
        }),
        ["42501"],
      );
    }
  });
  test("singleton, nominal, koordinat dan versi menolak nilai invalid", async () => {
    const { db } = connections().runtime;
    for (const statement of [
      sql`update site_state set content_version = -1`,
      sql`update site_state set content_version = 9007199254740992`,
      sql`update site_profile set id = 2`,
      sql`update site_profile set latitude = 0, longitude = null`,
      sql`update site_profile set latitude = 'NaN'::float8, longitude = 0`,
      sql`update operations_settings set monthly_budget_idr = -1`,
      sql`update operations_settings set monthly_budget_idr = 2147483648`,
      sql`update operations_settings set destination_manager_phone = '08123'`,
    ]) {
      await sqlFailure(
        rollback(db, async (tx) => {
          await tx.execute(statement);
        }),
        ["23514", "22003"],
      );
    }
    await rollback(db, async (tx) => {
      await tx
        .update(operationsSettings)
        .set({ monthlyBudgetIdr: 0, destinationManagerPhone: "+628123456789" });
      await tx.update(siteProfile).set({ latitude: 0, longitude: 0 });
      await tx.update(siteState).set({ contentVersion: Number.MAX_SAFE_INTEGER });
      expect((await tx.select().from(siteState))[0]?.contentVersion).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
  test("jadwal mendukung lintas tengah malam dan menolak durasi invalid", async () => {
    const { db } = connections().runtime;
    await rollback(db, async (tx) => {
      await tx
        .update(openingHours)
        .set({ status: "open", opensAt: "22:00", closesAt: "05:00", closesNextDay: true })
        .where(eq(openingHours.weekday, 1));
      expect(
        (await tx.select().from(openingHours).where(eq(openingHours.weekday, 1)))[0]?.closesAt,
      ).toBe("05:00:00");
    });
    for (const statement of [
      sql`update opening_hours set status = 'open', opens_at = '22:00', closes_at = '05:00', closes_next_day = false where weekday = 1`,
      sql`update opening_hours set status = 'open', opens_at = '08:00', closes_at = '09:00', closes_next_day = true where weekday = 1`,
      sql`update opening_hours set opens_at = '08:00' where weekday = 1`,
      sql`update opening_hours set status = 'open', opens_at = '24:00', closes_at = '05:00', closes_next_day = true where weekday = 1`,
    ])
      await sqlFailure(
        rollback(db, async (tx) => {
          await tx.execute(statement);
        }),
        ["23514"],
      );
  });
  test("foreign key RESTRICT melindungi media yang dirujuk", async () => {
    const { db } = connections().migration;
    await sqlFailure(
      rollback(db, async (tx) => {
        const [user] = await tx
          .insert(adminUsers)
          .values({
            email: "fixture@example.test",
            passwordHash: "$argon2id$fixture-not-a-credential",
          })
          .returning();
        if (!user) throw new Error("Fixture akun tidak tersedia.");
        const [media] = await tx
          .insert(mediaAssets)
          .values({
            uploaderId: user.id,
            uploadKey: "13c10cd4-226c-4efb-95e5-591781a79ce3",
            sourceSha256: "a".repeat(64),
          })
          .returning();
        if (!media) throw new Error("Fixture media tidak tersedia.");
        await tx
          .insert(galleryItems)
          .values({ mediaId: media.id, altText: "Fixture relasi saja", sortOrder: 0 });
        // T-11 adds ready-state/reference locking; this test isolates the FK.
        await tx.delete(mediaAssets).where(eq(mediaAssets.id, media.id));
      }),
      ["23503"],
    );
  });
  test("tarif default tersembunyi, harga nol sah dan harga negatif ditolak", async () => {
    const { db } = connections().runtime;
    await rollback(db, async (tx) => {
      const [ticket] = await tx
        .insert(ticketRates)
        .values({
          name: "Tarif nol — data uji",
          priceIdr: 0,
          unit: "per orang",
          terms: "Bukan tarif destinasi",
          sortOrder: 0,
        })
        .returning();
      expect(ticket).toMatchObject({ priceIdr: 0, isVisible: false });
    });
    await sqlFailure(
      rollback(db, async (tx) => {
        await tx.insert(ticketRates).values({
          name: "Tarif invalid — data uji",
          priceIdr: -1,
          unit: "per orang",
          terms: "Bukan tarif destinasi",
          sortOrder: 0,
        });
      }),
      ["23514"],
    );
  });
  test("scope receipt tetap unik ketika request hash berbeda", async () => {
    const { db } = connections().migration;
    await rollback(db, async (tx) => {
      const [user] = await tx
        .insert(adminUsers)
        .values({
          email: "receipt-fixture@example.test",
          passwordHash: "$argon2id$fixture-not-a-credential",
        })
        .returning();
      if (!user) throw new Error("Fixture akun tidak tersedia.");
      await tx.execute(
        sql`INSERT INTO mutation_receipts (admin_user_id, method, route, idempotency_key, request_hash, response_status, response_body, expires_at) VALUES (${user.id}, 'PUT', '/api/v1/admin/operations', '13c10cd4-226c-4efb-95e5-591781a79ce3', ${"a".repeat(64)}, 200, '{}'::jsonb, now() + interval '24 hours')`,
      );
      await sqlFailure(
        tx.transaction(async (nested) => {
          await nested.execute(
            sql`INSERT INTO mutation_receipts (admin_user_id, method, route, idempotency_key, request_hash, response_status, response_body, expires_at) VALUES (${user.id}, 'PUT', '/api/v1/admin/operations', '13c10cd4-226c-4efb-95e5-591781a79ce3', ${"b".repeat(64)}, 200, '{}'::jsonb, now() + interval '24 hours')`,
          );
        }),
        ["23505"],
      );
    });
  });
  test("runner menolak riwayat migrasi yang berubah", async () => {
    const { db } = connections().migration;
    await rollback(db, async (tx) => {
      await tx.execute(
        sql`UPDATE drizzle.__drizzle_migrations SET hash = 'changed-fixture' WHERE id = (SELECT min(id) FROM drizzle.__drizzle_migrations)`,
      );
      let rejected = false;
      try {
        await migrateDatabase(tx);
      } catch (error) {
        rejected =
          error instanceof Error && error.message === "Riwayat migrasi berbeda dari checkout ini.";
      }
      expect(rejected).toBe(true);
    });
  });
  test("fixture tersembunyi dan tidak mengubah tanggal publik/tiket", async () => {
    const { db } = connections().migration;
    await rollback(db, async (tx) => {
      const before = (await tx.select().from(siteState))[0];
      if (!before) throw new Error("State singleton hilang.");
      await insertDevelopmentFixture(tx);
      const after = (await tx.select().from(siteState))[0];
      expect(after).toEqual({ ...before, contentVersion: 1 });
      expect((await tx.select().from(ticketRates))[0]).toMatchObject({
        name: "Contoh tarif — data uji",
        priceIdr: 15000,
        isVisible: false,
      });
      expect(await tx.select().from(adminUsers)).toEqual([]);
      let rejected = false;
      try {
        await insertDevelopmentFixture(tx);
      } catch (error) {
        rejected =
          error instanceof Error &&
          error.message === "Fixture hanya boleh diterapkan pada database baru.";
      }
      expect(rejected).toBe(true);
    });
  });
});

registerAuthDatabaseTests(connections);
