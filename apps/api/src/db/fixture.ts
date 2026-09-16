import { eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import { attractions, contactChannels, facilities, siteState, ticketRates } from "./schema";

// No accounts, passwords, media objects or claims about real destination prices.
// This fixture is additive and refuses an edited/nonempty destination.
export async function insertDevelopmentFixture(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    const [state] = await tx.select().from(siteState).where(eq(siteState.id, 1)).for("update");
    if (!state || state.contentVersion !== 0)
      throw new Error("Fixture hanya boleh diterapkan pada database baru.");
    await tx.execute(sql`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM ticket_rates) OR EXISTS (SELECT 1 FROM attractions)
        OR EXISTS (SELECT 1 FROM facilities) OR EXISTS (SELECT 1 FROM contact_channels)
        OR EXISTS (SELECT 1 FROM gallery_items) OR EXISTS (SELECT 1 FROM media_assets)
      THEN RAISE EXCEPTION 'Fixture requires empty collections'; END IF;
    END $$`);
    await tx.insert(ticketRates).values({
      id: "8fb7c8ae-7b48-4dd2-8253-b312c1d86d38",
      name: "Contoh tarif — data uji",
      priceIdr: 15000,
      unit: "per orang",
      terms: "Ketentuan contoh untuk pengujian; bukan tarif destinasi.",
      sortOrder: 0,
    });
    await tx.insert(attractions).values({
      id: "78c9e7c0-0437-4dc0-9500-f932356493d9",
      name: "Contoh daya tarik — data uji",
      description: "Deskripsi fixture pengembangan.",
      sortOrder: 0,
    });
    await tx.insert(facilities).values({
      id: "90f7a944-6a71-4dd9-86bd-1d2fe70ca834",
      name: "Contoh fasilitas — data uji",
      sortOrder: 0,
    });
    await tx.insert(contactChannels).values({
      id: "c191ac86-9064-4ca3-9234-f4980b77d182",
      kind: "email",
      label: "Kontak contoh — data uji",
      value: "fixture@example.test",
      sortOrder: 0,
    });
    // All fixture rows are hidden, so public/ticket timestamps remain unchanged.
    await tx.update(siteState).set({ contentVersion: 1 }).where(eq(siteState.id, 1));
  });
}
