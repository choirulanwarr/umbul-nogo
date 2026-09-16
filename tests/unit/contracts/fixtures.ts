import type { DestinationFields } from "@umbul-nogo/contracts/destination";
import type { OperationsFields } from "@umbul-nogo/contracts/operations";
import type { PublicSiteDto } from "@umbul-nogo/contracts/public-site";

export const id = "8fb7c8ae-7b48-4dd2-8253-b312c1d86d38";
export const otherId = "478d88e2-5f11-46d4-bc21-f99e9ae81913";
export const key = "13c10cd4-226c-4efb-95e5-591781a79ce3";
export const now = "2026-09-16T00:00:00Z";
export const expires = "2026-09-17T00:00:00Z";
export function destination(): DestinationFields {
  return {
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
    openingHours: ([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => ({
      weekday,
      status: "unknown",
      opensAt: null,
      closesAt: null,
      closesNextDay: false,
    })),
    contacts: [],
  };
}
export function operations(): OperationsFields {
  return {
    monthlyBudgetIdr: null,
    destinationManagerName: null,
    destinationManagerPhone: null,
    destinationManagerEmail: null,
    technicalOperatorName: null,
    technicalOperatorPhone: null,
    technicalOperatorEmail: null,
    internalNotes: null,
  };
}
export const ticket = {
  name: "Contoh tarif — data uji",
  priceIdr: 15000,
  unit: "per orang",
  terms: "Ketentuan contoh untuk pengujian.",
  applicabilityNote: null,
  isVisible: false,
};
export const entityMeta = { id, sortOrder: 0, createdAt: now, updatedAt: now };
export const mutationMeta = {
  requestId: otherId,
  contentVersion: 1,
  publicUpdatedAt: now,
  ticketsUpdatedAt: null,
  idempotency: { key, replayed: false, originalRequestId: otherId, expiresAt: expires },
};
export const image = {
  alt: "Foto contoh — data uji",
  variants: [
    {
      url: "https://assets.example.test/test.webp",
      width: 320,
      height: 240,
      mimeType: "image/webp" as const,
      byteSize: 1024,
    },
  ],
};
export function publicSite(): PublicSiteDto {
  return {
    name: "UMBUL NOGO",
    introduction: null,
    region: "Wonogiri, Jawa Tengah",
    hero: null,
    logo: null,
    attractions: [],
    tickets: { currency: "IDR", updatedAt: null, items: [] },
    facilities: [],
    gallery: [],
    visit: {
      timezone: "Asia/Jakarta",
      address: null,
      coordinates: null,
      mapUrl: null,
      notes: null,
      openingHours: destination().openingHours,
      contacts: [],
    },
    seo: {
      title: "UMBUL NOGO",
      description: "Informasi wisata dan tiket masuk UMBUL NOGO di Wonogiri, Jawa Tengah.",
      image: null,
    },
    publicUpdatedAt: now,
  };
}
