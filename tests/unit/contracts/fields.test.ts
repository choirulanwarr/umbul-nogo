import { describe, expect, test } from "bun:test";
import {
  loginRequestSchema,
  sessionResponseSchema,
  logoutRequestSchema,
} from "@umbul-nogo/contracts/auth";
import { contactInputSchema, publicContactSchema } from "@umbul-nogo/contracts/contacts";
import { destinationRequestSchema, destinationDtoSchema } from "@umbul-nogo/contracts/destination";
import { openingHoursSchema } from "@umbul-nogo/contracts/opening-hours";
import { operationsFieldsSchema, operationsRequestSchema } from "@umbul-nogo/contracts/operations";
import { seoRequestSchema } from "@umbul-nogo/contracts/seo";
import {
  contentVersionSchema,
  deleteContentQuerySchema,
  httpsUrlSchema,
  moneyIdrSchema,
  textSchema,
  timestampSchema,
  uuidSchema,
} from "@umbul-nogo/contracts/primitives";
import { destination, id, now, operations } from "./fixtures";

describe("nilai primitif dan normalisasi", () => {
  test("nominal membedakan nol, null, kosong, pecahan dan batas integer", () => {
    for (const value of [0, 2_147_483_647]) expect(moneyIdrSchema.parse(value)).toBe(value);
    for (const value of [
      null,
      undefined,
      "",
      "0",
      "15000",
      -1,
      0.5,
      2_147_483_648,
      NaN,
      Infinity,
      false,
    ])
      expect(moneyIdrSchema.safeParse(value).success).toBe(false);
    expect(contentVersionSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(contentVersionSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });
  test("panjang dihitung per code point setelah trim tanpa normalisasi Unicode", () => {
    expect(textSchema(2).parse("  😀😀  ")).toBe("😀😀");
    expect(textSchema(2).safeParse("😀😀😀").success).toBe(false);
    expect(textSchema(1).safeParse("e\u0301").success).toBe(false);
    expect(textSchema(2).parse("e\u0301")).toBe("e\u0301");
    expect(textSchema(5).safeParse(" \n ").success).toBe(false);
  });
  test("DELETE hanya menerima query desimal kanonis tunggal", () => {
    expect(deleteContentQuerySchema.parse({ expectedContentVersion: "0" })).toEqual({
      expectedContentVersion: 0,
    });
    for (const value of [0, "01", "+1", "1.0", "1e2", " 1", "-1", "9007199254740992", ["1", "2"]])
      expect(deleteContentQuerySchema.safeParse({ expectedContentVersion: value }).success).toBe(
        false,
      );
    expect(
      deleteContentQuerySchema.safeParse({ expectedContentVersion: "1", extra: "x" }).success,
    ).toBe(false);
  });
  test("UUID lowercase, timestamp UTC dan URL HTTPS tanpa kredensial", () => {
    expect(uuidSchema.parse(id)).toBe(id);
    expect(uuidSchema.safeParse(id.toUpperCase()).success).toBe(false);
    expect(timestampSchema.parse(now)).toBe(now);
    for (const value of ["2026-02-30T00:00:00Z", "2026-09-16", "2026-09-16T07:00:00+07:00"])
      expect(timestampSchema.safeParse(value).success).toBe(false);
    expect(httpsUrlSchema.parse(" https://example.test/map ")).toBe("https://example.test/map");
    for (const value of [
      "http://example.test",
      "javascript:alert(1)",
      "https://user:pass@example.test",
      "//example.test",
      "https:example.test",
      "https://example.test/a b",
    ])
      expect(httpsUrlSchema.safeParse(value).success).toBe(false);
  });
});

describe("profil, kontak, sesi dan operasional", () => {
  test("profil awal sah, koordinat nol sah, field nullable wajib hadir", () => {
    expect(
      destinationRequestSchema.parse({ ...destination(), expectedContentVersion: 0 }).name,
    ).toBe("UMBUL NOGO");
    expect(
      destinationRequestSchema.safeParse({
        ...destination(),
        latitude: 0,
        longitude: 0,
        expectedContentVersion: 0,
      }).success,
    ).toBe(true);
    for (const change of [
      { latitude: 0 },
      { latitude: 91, longitude: 0 },
      { heroMediaId: id },
      { heroAlt: "x" },
      { name: "" },
      { address: " " },
      { region: undefined },
      { contentVersion: 1 },
    ])
      expect(
        destinationRequestSchema.safeParse({
          ...destination(),
          expectedContentVersion: 0,
          ...change,
        }).success,
      ).toBe(false);
  });
  test("kontak baru null, kontak respons harus UUID, ID ganda ditolak", () => {
    const contact = {
      id: null,
      kind: "phone",
      label: "Kontak uji",
      value: "+628123456789",
      isVisible: false,
    };
    expect(
      destinationRequestSchema.safeParse({
        ...destination(),
        expectedContentVersion: 0,
        contacts: [contact, contact],
      }).success,
    ).toBe(true);
    expect(
      destinationRequestSchema.safeParse({
        ...destination(),
        expectedContentVersion: 0,
        contacts: [
          { ...contact, id },
          { ...contact, id },
        ],
      }).success,
    ).toBe(false);
    expect(
      destinationDtoSchema.safeParse({
        ...destination(),
        heroPreview: null,
        logoPreview: null,
        contacts: [contact],
      }).success,
    ).toBe(false);
  });
  test.each([
    ["phone", "+628123456789", "08123456789"],
    ["whatsapp", "+12345678", "+012345678"],
    ["email", "operator@example.test", "invalid"],
    ["website", "https://example.test", "http://example.test"],
    ["instagram", "https://www.instagram.com/example", "https://instagram.com.evil.test/example"],
  ])("kontak %s tetap divalidasi saat tersembunyi", (kind, valid, invalid) => {
    const base = { id: null, kind, label: "Contoh", isVisible: false };
    expect(contactInputSchema.safeParse({ ...base, value: valid }).success).toBe(true);
    expect(contactInputSchema.safeParse({ ...base, value: invalid }).success).toBe(false);
  });
  test("URL Instagram rusak menghasilkan error validasi tanpa exception", () => {
    for (const value of ["bukan-url", "", "https://", "javascript:alert(1)"]) {
      expect(
        contactInputSchema.safeParse({
          id: null,
          kind: "instagram",
          label: "Uji",
          value,
          isVisible: false,
        }).success,
      ).toBe(false);
    }
  });
  test("href publik mengikuti jenis tanpa protokol eksekusi", () => {
    expect(
      publicContactSchema.safeParse({
        id,
        kind: "phone",
        label: "Contoh",
        href: "tel:+628123456789",
      }).success,
    ).toBe(true);
    expect(
      publicContactSchema.safeParse({
        id,
        kind: "phone",
        label: "Contoh",
        href: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
  test("login lowercase/trim email, password tidak berubah dan batas code point", () => {
    const password = "  kata sandi contoh  ";
    expect(loginRequestSchema.parse({ email: " ADMIN@EXAMPLE.TEST ", password })).toEqual({
      email: "admin@example.test",
      password,
    });
    expect(
      loginRequestSchema.safeParse({ email: "a@example.test", password: "😀".repeat(15) }).success,
    ).toBe(true);
    for (const length of [14, 129])
      expect(
        loginRequestSchema.safeParse({ email: "a@example.test", password: "a".repeat(length) })
          .success,
      ).toBe(false);
    expect(logoutRequestSchema.safeParse({ token: "secret" }).success).toBe(false);
    expect(
      sessionResponseSchema.safeParse({
        success: true,
        data: {
          user: { id, email: "a@example.test", role: "admin", passwordHash: "secret" },
          expiresAt: now,
          idleExpiresAt: now,
        },
        meta: { requestId: id },
      }).success,
    ).toBe(false);
  });
  test("operasional null atau nol dan field independen; bukan konfigurasi deployment", () => {
    expect(operationsFieldsSchema.parse(operations())).toEqual(operations());
    expect(
      operationsRequestSchema.parse({
        ...operations(),
        monthlyBudgetIdr: 0,
        technicalOperatorPhone: "+628123456789",
        expectedContentVersion: 0,
      }).monthlyBudgetIdr,
    ).toBe(0);
    for (const change of [
      { monthlyBudgetIdr: "0" },
      { monthlyBudgetIdr: -1 },
      { monthlyBudgetIdr: 0.5 },
      { monthlyBudgetIdr: 2_147_483_648 },
      { internalNotes: " " },
      { destinationManagerName: undefined },
      { databaseUrl: "secret" },
    ])
      expect(operationsFieldsSchema.safeParse({ ...operations(), ...change }).success).toBe(false);
    expect(
      operationsFieldsSchema.safeParse({ ...operations(), internalNotes: "😀".repeat(2000) })
        .success,
    ).toBe(true);
    expect(
      operationsFieldsSchema.safeParse({ ...operations(), internalNotes: "😀".repeat(2001) })
        .success,
    ).toBe(false);
  });
  test("SEO nullable lengkap tanpa canonical atau field profil", () => {
    const seo = { title: null, description: null, imageMediaId: null, expectedContentVersion: 0 };
    expect(seoRequestSchema.safeParse(seo).success).toBe(true);
    for (const change of [
      { title: "" },
      { description: "a".repeat(321) },
      { canonical: "https://example.test" },
      { name: "x" },
    ])
      expect(seoRequestSchema.safeParse({ ...seo, ...change }).success).toBe(false);
  });
});

describe("jadwal mingguan", () => {
  test("tepat tujuh hari unik dinormalisasi tanpa mengubah input", () => {
    const days = destination().openingHours.reverse();
    expect(openingHoursSchema.parse(days).map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days[0]?.weekday).toBe(7);
    expect(openingHoursSchema.safeParse(days.slice(1)).success).toBe(false);
    expect(openingHoursSchema.safeParse([...days.slice(1), days[1]]).success).toBe(false);
  });
  test.each([
    ["08:00", "17:00", false, true],
    ["22:00", "05:00", true, true],
    ["22:00", "05:00", false, false],
    ["08:00", "08:00", true, true],
    ["08:00", "08:00", false, false],
    ["08:00", "09:00", true, false],
    ["24:00", "05:00", true, false],
    ["8:00", "17:00", false, false],
  ])("durasi %s–%s esok=%s", (opensAt, closesAt, closesNextDay, valid) => {
    const days = destination().openingHours;
    days[0] = { weekday: 1, status: "open", opensAt, closesAt, closesNextDay };
    expect(openingHoursSchema.safeParse(days).success).toBe(valid);
  });
  test("benturan Minggu–Senin ditolak pada indeks input, batas bersentuhan sah", () => {
    const days = destination().openingHours;
    days[6] = {
      weekday: 7,
      status: "open",
      opensAt: "22:00",
      closesAt: "05:00",
      closesNextDay: true,
    };
    days[0] = {
      weekday: 1,
      status: "open",
      opensAt: "04:59",
      closesAt: "17:00",
      closesNextDay: false,
    };
    const result = openingHoursSchema.safeParse([...days].reverse());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual([6, "opensAt"]);
    days[0] = { ...days[0], opensAt: "05:00" };
    expect(openingHoursSchema.safeParse(days).success).toBe(true);
    days[0] = { weekday: 1, status: "closed", opensAt: null, closesAt: null, closesNextDay: false };
    expect(openingHoursSchema.safeParse(days).success).toBe(true);
    expect(
      openingHoursSchema.safeParse([{ ...days[0], opensAt: "00:00" }, ...days.slice(1)]).success,
    ).toBe(false);
  });
});
