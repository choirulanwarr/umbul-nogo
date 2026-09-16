import { describe, expect, test } from "bun:test";
import {
  attractionCreateSchema,
  attractionUpdateSchema,
  attractionDtoSchema,
} from "@umbul-nogo/contracts/attractions";
import { facilityCreateSchema, facilityUpdateSchema } from "@umbul-nogo/contracts/facilities";
import {
  galleryItemCreateSchema,
  galleryItemUpdateSchema,
} from "@umbul-nogo/contracts/gallery-items";
import {
  ticketRateCreateSchema,
  ticketRateUpdateSchema,
  ticketRateDtoSchema,
  ticketRateListResponseSchema,
  ticketRateMutationResponseSchema,
} from "@umbul-nogo/contracts/ticket-rates";
import { imageSchema } from "@umbul-nogo/contracts/images";
import { apiFailureSchema, ERROR_HTTP_STATUS, toFieldErrors } from "@umbul-nogo/contracts/errors";
import {
  mediaCursorSchema,
  mediaUploadRequestSchema,
  mediaDtoSchema,
  mediaListQuerySchema,
  mediaReferenceSchema,
  mediaReadyResponseSchema,
  mediaPendingResponseSchema,
} from "@umbul-nogo/contracts/media";
import {
  mutationReceiptQuerySchema,
  mutationReceiptSchema,
} from "@umbul-nogo/contracts/mutation-receipts";
import { publicSiteResponseSchema, publicSiteSchema } from "@umbul-nogo/contracts/public-site";
import {
  entityMeta,
  expires,
  id,
  image,
  key,
  mutationMeta,
  now,
  operations,
  otherId,
  publicSite,
  ticket,
} from "./fixtures";

describe("empat koleksi", () => {
  const cases = [
    {
      name: "tarif",
      create: ticketRateCreateSchema,
      update: ticketRateUpdateSchema,
      fields: ticket,
    },
    {
      name: "daya tarik",
      create: attractionCreateSchema,
      update: attractionUpdateSchema,
      fields: {
        name: "Contoh",
        description: null,
        mediaId: null,
        imageAlt: null,
        isVisible: false,
      },
    },
    {
      name: "fasilitas",
      create: facilityCreateSchema,
      update: facilityUpdateSchema,
      fields: { name: "Contoh", description: null, isVisible: false },
    },
    {
      name: "galeri",
      create: galleryItemCreateSchema,
      update: galleryItemUpdateSchema,
      fields: { mediaId: id, altText: "Foto contoh", caption: null, isVisible: false },
    },
  ];
  for (const entry of cases) {
    test(`${entry.name}: POST default tersembunyi, PUT wajib lengkap, readonly ditolak`, () => {
      const { isVisible, ...fields } = entry.fields;
      expect(isVisible).toBe(false);
      expect(entry.create.parse({ ...fields, expectedContentVersion: 0 }).isVisible).toBe(false);
      expect(entry.update.safeParse({ ...fields, expectedContentVersion: 0 }).success).toBe(false);
      expect(entry.update.safeParse({ ...entry.fields, expectedContentVersion: 0 }).success).toBe(
        true,
      );
      for (const change of [
        { id },
        { sortOrder: 0 },
        { createdAt: now },
        { extra: true },
        { isVisible: "false" },
      ])
        expect(
          entry.create.safeParse({ ...fields, expectedContentVersion: 0, ...change }).success,
        ).toBe(false);
    });
  }
  test("daya tarik tampil memerlukan deskripsi dan media berpasangan saat tersembunyi", () => {
    const fields = {
      name: "Contoh",
      description: null,
      mediaId: null,
      imageAlt: null,
      expectedContentVersion: 0,
    };
    expect(attractionCreateSchema.safeParse({ ...fields, isVisible: true }).success).toBe(false);
    expect(
      attractionCreateSchema.safeParse({ ...fields, isVisible: true, description: "Deskripsi uji" })
        .success,
    ).toBe(true);
    expect(attractionCreateSchema.safeParse({ ...fields, mediaId: id }).success).toBe(false);
    expect(
      attractionDtoSchema.safeParse({
        ...fields,
        ...entityMeta,
        isVisible: false,
        imagePreview: null,
      }).success,
    ).toBe(false); // request version is not a DTO field
  });
  test("tarif menerima harga gratis eksplisit tanpa fallback dan menolak desimal", () => {
    expect(
      ticketRateCreateSchema.parse({ ...ticket, priceIdr: 0, expectedContentVersion: 0 }).priceIdr,
    ).toBe(0);
    for (const priceIdr of [null, undefined, "", "0", -1, 1.5, 2_147_483_648])
      expect(
        ticketRateUpdateSchema.safeParse({ ...ticket, priceIdr, expectedContentVersion: 0 })
          .success,
      ).toBe(false);
    expect(ticketRateDtoSchema.parse({ ...ticket, ...entityMeta }).id).toBe(id);
    expect(ticketRateDtoSchema.safeParse({ ...ticket, ...entityMeta, sortOrder: -1 }).success).toBe(
      false,
    );
  });
});

describe("publik dan envelope", () => {
  test("snapshot awal sah tanpa tarif/foto/jam rekaan", () => {
    expect(publicSiteSchema.parse(publicSite())).toEqual(publicSite());
    const site = publicSite();
    site.seo.description = "😀".repeat(2000);
    expect(publicSiteSchema.safeParse(site).success).toBe(true); // introduction fallback, not the SEO override limit
  });
  test("data privat, field administratif dan storage ditolak di semua kedalaman", () => {
    for (const change of [
      { operations: operations() },
      { monthlyBudgetIdr: 0 },
      { contentVersion: 1 },
      { internalNotes: "PRIVATE" },
    ])
      expect(publicSiteSchema.safeParse({ ...publicSite(), ...change }).success).toBe(false);
    expect(
      publicSiteSchema.safeParse({
        ...publicSite(),
        tickets: { currency: "IDR", updatedAt: null, items: [{ ...ticket, id }] },
      }).success,
    ).toBe(false);
    expect(
      publicSiteSchema.safeParse({ ...publicSite(), hero: { ...image, storageKey: "private" } })
        .success,
    ).toBe(false);
    expect(
      publicSiteSchema.safeParse({
        ...publicSite(),
        visit: {
          ...publicSite().visit,
          contacts: [
            { id, kind: "phone", label: "Uji", href: "tel:+628123456789", isVisible: false },
          ],
        },
      }).success,
    ).toBe(false);
  });
  test("metadata publik/admin/mutasi dipisahkan dan respons gagal bukan sukses", () => {
    const publicResponse = { success: true, data: publicSite(), meta: { requestId: id } };
    expect(publicSiteResponseSchema.safeParse(publicResponse).success).toBe(true);
    expect(
      publicSiteResponseSchema.safeParse({ ...publicResponse, meta: mutationMeta }).success,
    ).toBe(false);
    expect(
      ticketRateListResponseSchema.safeParse({
        success: true,
        data: { items: [] },
        meta: { requestId: id, contentVersion: 0, publicUpdatedAt: now, ticketsUpdatedAt: null },
      }).success,
    ).toBe(true);
    expect(
      ticketRateListResponseSchema.safeParse({
        success: true,
        data: { items: [] },
        meta: { requestId: id },
      }).success,
    ).toBe(false);
    expect(
      ticketRateMutationResponseSchema.safeParse({
        success: true,
        data: { ...ticket, ...entityMeta },
        meta: mutationMeta,
      }).success,
    ).toBe(true);
    expect(publicSiteResponseSchema.safeParse({ ...publicResponse, success: false }).success).toBe(
      false,
    );
  });
});

describe("media", () => {
  test("multipart membutuhkan tepat satu file dengan batas byte", () => {
    const file = new File([new Uint8Array([1])], "fixture.png");
    expect(mediaUploadRequestSchema.safeParse({ file }).success).toBe(true);
    expect(mediaUploadRequestSchema.safeParse({ file, extra: "x" }).success).toBe(false);
    expect(mediaUploadRequestSchema.safeParse({ file: [file, file] }).success).toBe(false);
    expect(mediaUploadRequestSchema.safeParse({ file: "fixture.png" }).success).toBe(false);
    expect(mediaUploadRequestSchema.safeParse({ file: new File([], "empty.png") }).success).toBe(
      false,
    );
    expect(
      mediaUploadRequestSchema.safeParse({
        file: new File([new Uint8Array(5_242_881)], "large.png"),
      }).success,
    ).toBe(false);
  });
  const media = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "ready",
    variants: image.variants,
    deletedAt: null,
    canRetryUpload: false,
    failureCode: null,
    references: [],
  };
  test("varian wajib, lebar unik terurut, dimensi/byte positif dan WebP", () => {
    expect(imageSchema.safeParse(image).success).toBe(true);
    for (const variants of [
      [],
      [...image.variants, ...image.variants],
      [{ ...image.variants[0], width: 640 }, ...image.variants],
      [{ ...image.variants[0], byteSize: 0 }],
      [{ ...image.variants[0], mimeType: "image/png" }],
    ])
      expect(imageSchema.safeParse({ ...image, variants }).success).toBe(false);
  });
  test("hanya ready membawa varian dan 202 belum dapat digunakan", () => {
    expect(mediaDtoSchema.safeParse(media).success).toBe(true);
    const pending = { ...media, status: "processing", variants: [] };
    expect(mediaDtoSchema.safeParse(pending).success).toBe(true);
    expect(mediaDtoSchema.safeParse({ ...pending, variants: image.variants }).success).toBe(false);
    expect(
      mediaReadyResponseSchema.safeParse({ success: true, data: pending, meta: { requestId: id } })
        .success,
    ).toBe(false);
    expect(
      mediaPendingResponseSchema.safeParse({
        success: true,
        data: pending,
        meta: { requestId: id },
      }).success,
    ).toBe(true);
    expect(
      mediaDtoSchema.safeParse({
        ...pending,
        status: "failed",
        failureCode: "IMAGE_INVALID",
        canRetryUpload: true,
      }).success,
    ).toBe(false);
    expect(
      mediaDtoSchema.safeParse({ ...pending, status: "deleted", deletedAt: null }).success,
    ).toBe(false);
    expect(mediaDtoSchema.safeParse({ ...media, lease: "secret" }).success).toBe(false);
  });
  test("referensi membatasi field dan ID sesuai resource", () => {
    expect(
      mediaReferenceSchema.safeParse({
        resource: "destination",
        id: null,
        field: "heroMediaId",
        label: "Hero",
      }).success,
    ).toBe(true);
    for (const reference of [
      { resource: "destination", id, field: "heroMediaId", label: "Hero" },
      { resource: "seo", id: null, field: "password", label: "Uji" },
      { resource: "attractions", id: null, field: "mediaId", label: "Uji" },
    ])
      expect(mediaReferenceSchema.safeParse(reference).success).toBe(false);
  });
  test("pagination default 24, limit 1–100 dan cursor terdecode strict", () => {
    expect(mediaListQuerySchema.parse({})).toEqual({ limit: 24 });
    for (const limit of ["1", "100"])
      expect(mediaListQuerySchema.parse({ limit }).limit).toBe(Number(limit));
    for (const limit of ["0", "101", "1.5", "1e2", ["1", "2"]])
      expect(mediaListQuerySchema.safeParse({ limit }).success).toBe(false);
    expect(mediaListQuerySchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(mediaListQuerySchema.safeParse({ sort: "asc" }).success).toBe(false);
    expect(mediaCursorSchema.safeParse({ createdAt: now, id, status: null }).success).toBe(true);
    expect(
      mediaCursorSchema.safeParse({ createdAt: now, id, status: null, sql: "DELETE" }).success,
    ).toBe(false);
  });
});

describe("receipt", () => {
  const receipt = {
    key,
    method: "POST",
    path: "/api/v1/admin/ticket-rates",
    expiresAt: expires,
    responseStatus: 201,
    responseBody: { success: true, data: { ...ticket, ...entityMeta }, meta: mutationMeta },
  };
  test("hanya katalog mutasi dengan path/metode kanonis", () => {
    for (const collection of ["attractions", "ticket-rates", "facilities", "gallery-items"]) {
      for (const method of ["PUT", "DELETE"])
        expect(
          mutationReceiptQuerySchema.safeParse({
            method,
            path: `/api/v1/admin/${collection}/${id}`,
          }).success,
        ).toBe(true);
      expect(
        mutationReceiptQuerySchema.safeParse({
          method: "POST",
          path: `/api/v1/admin/${collection}`,
        }).success,
      ).toBe(true);
      expect(
        mutationReceiptQuerySchema.safeParse({
          method: "PUT",
          path: `/api/v1/admin/${collection}/order`,
        }).success,
      ).toBe(true);
    }
    for (const path of ["destination", "seo", "operations"])
      expect(
        mutationReceiptQuerySchema.safeParse({ method: "PUT", path: `/api/v1/admin/${path}` })
          .success,
      ).toBe(true);
    for (const query of [
      { method: "DELETE", path: "/api/v1/admin/operations" },
      { method: "POST", path: "/api/v1/admin/media/uploads" },
      { method: "GET", path: receipt.path },
      { method: "POST", path: receipt.path + "/" },
      { method: "POST", path: receipt.path + "?x=1" },
      { method: "PUT", path: `/api/v1/admin/ticket-rates/${id.toUpperCase()}` },
      { method: "PUT", path: "https://evil.test/api/v1/admin/operations" },
    ])
      expect(mutationReceiptQuerySchema.safeParse(query).success).toBe(false);
  });
  test("status/bentuk hasil sesuai path serta metadata commit asli", () => {
    expect(mutationReceiptSchema.safeParse(receipt).success).toBe(true);
    for (const change of [
      { responseStatus: 200 },
      { path: "/api/v1/admin/facilities" },
      { key: otherId },
      { expiresAt: now },
    ])
      expect(mutationReceiptSchema.safeParse({ ...receipt, ...change }).success).toBe(false);
    expect(
      mutationReceiptSchema.safeParse({
        ...receipt,
        responseBody: {
          ...receipt.responseBody,
          meta: { ...mutationMeta, idempotency: { ...mutationMeta.idempotency, replayed: true } },
        },
      }).success,
    ).toBe(false);
    expect(
      mutationReceiptSchema.safeParse({
        ...receipt,
        method: "PUT",
        path: `/api/v1/admin/ticket-rates/${otherId}`,
        responseStatus: 200,
      }).success,
    ).toBe(false);
    expect(
      mutationReceiptSchema.safeParse({
        ...receipt,
        method: "DELETE",
        path: `/api/v1/admin/ticket-rates/${id}`,
        responseStatus: 200,
        responseBody: { ...receipt.responseBody, data: { id, deleted: true } },
      }).success,
    ).toBe(true);
    expect(
      mutationReceiptSchema.safeParse({
        ...receipt,
        method: "PUT",
        path: "/api/v1/admin/operations",
        responseStatus: 200,
        responseBody: { ...receipt.responseBody, data: operations() },
      }).success,
    ).toBe(true);
  });
});

describe("katalog error", () => {
  test("semua kode memiliki status dan details strict sesuai kode", () => {
    for (const code of Object.keys(ERROR_HTTP_STATUS)) {
      const error = {
        code,
        message:
          code === "INVALID_CREDENTIALS" ? "Email atau kata sandi tidak sesuai." : "Pesan aman.",
        ...(code === "CONTENT_VERSION_CONFLICT"
          ? { details: { expectedContentVersion: 0, currentContentVersion: 1 } }
          : {}),
        ...(code === "MEDIA_IN_USE"
          ? {
              details: {
                references: [
                  { resource: "destination", id: null, field: "heroMediaId", label: "Hero" },
                ],
              },
            }
          : {}),
        ...(code === "VALIDATION_ERROR"
          ? {
              fieldErrors: [
                { path: "priceIdr", code: "OUT_OF_RANGE", message: "Nilai tidak sah." },
              ],
            }
          : {}),
      };
      expect(
        apiFailureSchema.safeParse({ success: false, error, meta: { requestId: id } }).success,
      ).toBe(true);
    }
    for (const error of [
      { code: "INTERNAL_ERROR", message: "Gagal", details: { sql: "secret" } },
      { code: "CONTENT_VERSION_CONFLICT", message: "Konflik" },
      { code: "INVALID_CREDENTIALS", message: "Akun nonaktif" },
      { code: "UNKNOWN", message: "Gagal" },
    ])
      expect(
        apiFailureSchema.safeParse({ success: false, error, meta: { requestId: id } }).success,
      ).toBe(false);
  });
  test("field error aman dan path bertingkat memakai indeks input", () => {
    const result = ticketRateUpdateSchema.safeParse({
      ...ticket,
      priceIdr: -1,
      expectedContentVersion: 0,
      secretField: "PRIVATE",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toFieldErrors(result.error)).toContainEqual({
        path: "priceIdr",
        code: "OUT_OF_RANGE",
        message: "Nilai di luar rentang yang diizinkan.",
      });
      expect(JSON.stringify(toFieldErrors(result.error))).not.toContain("secretField");
      expect(JSON.stringify(toFieldErrors(result.error))).not.toContain("PRIVATE");
    }
  });
});
