import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { MutationReceiptDto } from "@umbul-nogo/contracts/mutation-receipts";

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const timestamps = () => ({
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
});
const collection = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  isVisible: boolean("is_visible").notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps(),
});
const length = (name: string, column: AnyPgColumn, max: number) =>
  check(name, sql`char_length(btrim(${column})) between 1 and ${sql.raw(String(max))}`);
const phone = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} ~ '^[+][1-9][0-9]{7,14}$'`);
const hash = (name: string, column: AnyPgColumn) => check(name, sql`${column} ~ '^[0-9a-f]{64}$'`);
const order = (
  name: string,
  columns: { isVisible: AnyPgColumn; sortOrder: AnyPgColumn; id: AnyPgColumn },
) => [
  check(`${name}_sort_nonnegative`, sql`${columns.sortOrder} >= 0`),
  index(`${name}_public_order_idx`).on(columns.isVisible, columns.sortOrder, columns.id),
];

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("admin_users_email_unique").on(t.email),
    length("admin_users_email_length", t.email, 254),
    check("admin_users_email_normalized", sql`${t.email} = lower(btrim(${t.email}))`),
    check("admin_users_password_argon2id", sql`${t.passwordHash} like '$argon2id$%'`),
  ],
);

// Private manifest: object identities are never shared DTO URLs. Runtime parsing
// and verification of the complete manifest belong to the media service.
export type StoredImageVariant = {
  objectKey: string;
  width: number;
  height: number;
  mimeType: "image/webp";
  byteSize: number;
  sha256: string;
};
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: text("status", { enum: ["processing", "ready", "failed", "deleting", "deleted"] })
      .notNull()
      .default("processing"),
    uploadKey: uuid("upload_key").notNull(),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
    sourceSha256: text("source_sha256").notNull(),
    attemptId: uuid("attempt_id"),
    leaseUntil: instant("lease_until"),
    variants: jsonb("variants")
      .$type<StoredImageVariant[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    failureCode: text("failure_code", {
      enum: ["IMAGE_INVALID", "STORAGE_UNAVAILABLE", "UPLOAD_INTERRUPTED"],
    }),
    ...timestamps(),
    deletedAt: instant("deleted_at"),
  },
  (t) => [
    uniqueIndex("media_assets_upload_unique").on(t.uploaderId, t.uploadKey),
    index("media_assets_lease_idx").on(t.status, t.leaseUntil),
    index("media_assets_library_idx").on(t.createdAt.desc(), t.id.desc()),
    index("media_assets_status_library_idx").on(t.status, t.createdAt.desc(), t.id.desc()),
    hash("media_assets_source_hash", t.sourceSha256),
    check(
      "media_assets_status_valid",
      sql`${t.status} in ('processing','ready','failed','deleting','deleted')`,
    ),
    check(
      "media_assets_failure_valid",
      sql`${t.failureCode} in ('IMAGE_INVALID','STORAGE_UNAVAILABLE','UPLOAD_INTERRUPTED')`,
    ),
    check("media_assets_manifest_array", sql`jsonb_typeof(${t.variants}) = 'array'`),
    check(
      "media_assets_ready_manifest",
      sql`${t.status} <> 'ready' or (jsonb_array_length(${t.variants}) > 0 and ${t.failureCode} is null)`,
    ),
    check(
      "media_assets_deleted_timestamp",
      sql`(${t.status} = 'deleted') = (${t.deletedAt} is not null)`,
    ),
    check("media_assets_lease_attempt", sql`${t.leaseUntil} is null or ${t.attemptId} is not null`),
  ],
);
const mediaId = (name: string) =>
  uuid(name).references(() => mediaAssets.id, { onDelete: "restrict" });
export const siteProfile = pgTable(
  "site_profile",
  {
    id: integer("id").primaryKey().default(1),
    name: text("name").notNull(),
    introduction: text("introduction"),
    region: text("region").notNull(),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    mapUrl: text("map_url"),
    visitNotes: text("visit_notes"),
    heroMediaId: mediaId("hero_media_id"),
    heroAlt: text("hero_alt"),
    logoMediaId: mediaId("logo_media_id"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoMediaId: mediaId("seo_media_id"),
  },
  (t) => [
    check("site_profile_singleton", sql`${t.id} = 1`),
    length("site_profile_name_length", t.name, 120),
    length("site_profile_region_length", t.region, 160),
    length("site_profile_introduction_length", t.introduction, 2000),
    length("site_profile_address_length", t.address, 1000),
    length("site_profile_notes_length", t.visitNotes, 3000),
    length("site_profile_hero_alt_length", t.heroAlt, 200),
    length("site_profile_seo_title_length", t.seoTitle, 120),
    length("site_profile_seo_description_length", t.seoDescription, 320),
    length("site_profile_map_length", t.mapUrl, 2048),
    check(
      "site_profile_coordinates_paired",
      sql`(${t.latitude} is null) = (${t.longitude} is null)`,
    ),
    check("site_profile_latitude_range", sql`${t.latitude} between -90 and 90`),
    check("site_profile_longitude_range", sql`${t.longitude} between -180 and 180`),
    check("site_profile_hero_paired", sql`(${t.heroMediaId} is null) = (${t.heroAlt} is null)`),
  ],
);
export const siteState = pgTable(
  "site_state",
  {
    id: integer("id").primaryKey().default(1),
    contentVersion: bigint("content_version", { mode: "number" }).notNull().default(0),
    publicUpdatedAt: instant("public_updated_at").notNull().defaultNow(),
    ticketsUpdatedAt: instant("tickets_updated_at"),
  },
  (t) => [
    check("site_state_singleton", sql`${t.id} = 1`),
    check("site_state_version_safe", sql`${t.contentVersion} between 0 and 9007199254740991`),
  ],
);
export const operationsSettings = pgTable(
  "operations_settings",
  {
    id: integer("id").primaryKey().default(1),
    monthlyBudgetIdr: integer("monthly_budget_idr"),
    destinationManagerName: text("destination_manager_name"),
    destinationManagerPhone: text("destination_manager_phone"),
    destinationManagerEmail: text("destination_manager_email"),
    technicalOperatorName: text("technical_operator_name"),
    technicalOperatorPhone: text("technical_operator_phone"),
    technicalOperatorEmail: text("technical_operator_email"),
    internalNotes: text("internal_notes"),
  },
  (t) => [
    check("operations_settings_singleton", sql`${t.id} = 1`),
    check("operations_settings_budget_nonnegative", sql`${t.monthlyBudgetIdr} >= 0`),
    length("operations_manager_name_length", t.destinationManagerName, 120),
    length("operations_operator_name_length", t.technicalOperatorName, 120),
    length("operations_manager_email_length", t.destinationManagerEmail, 254),
    length("operations_operator_email_length", t.technicalOperatorEmail, 254),
    length("operations_notes_length", t.internalNotes, 2000),
    phone("operations_manager_phone_format", t.destinationManagerPhone),
    phone("operations_operator_phone_format", t.technicalOperatorPhone),
  ],
);
export const attractions = pgTable(
  "attractions",
  {
    ...collection(),
    name: text("name").notNull(),
    description: text("description"),
    mediaId: mediaId("media_id"),
    imageAlt: text("image_alt"),
  },
  (t) => [
    ...order("attractions", t),
    length("attractions_name_length", t.name, 120),
    length("attractions_description_length", t.description, 3000),
    length("attractions_alt_length", t.imageAlt, 200),
    check("attractions_visible_complete", sql`not ${t.isVisible} or ${t.description} is not null`),
    check("attractions_media_paired", sql`(${t.mediaId} is null) = (${t.imageAlt} is null)`),
    index("attractions_media_idx").on(t.mediaId),
  ],
);
export const ticketRates = pgTable(
  "ticket_rates",
  {
    ...collection(),
    name: text("name").notNull(),
    priceIdr: integer("price_idr").notNull(),
    unit: text("unit").notNull(),
    terms: text("terms").notNull(),
    applicabilityNote: text("applicability_note"),
  },
  (t) => [
    ...order("ticket_rates", t),
    check("ticket_rates_price_nonnegative", sql`${t.priceIdr} >= 0`),
    length("ticket_rates_name_length", t.name, 100),
    length("ticket_rates_unit_length", t.unit, 60),
    length("ticket_rates_terms_length", t.terms, 3000),
    length("ticket_rates_note_length", t.applicabilityNote, 500),
  ],
);
export const facilities = pgTable(
  "facilities",
  {
    ...collection(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (t) => [
    ...order("facilities", t),
    length("facilities_name_length", t.name, 100),
    length("facilities_description_length", t.description, 1000),
  ],
);
export const galleryItems = pgTable(
  "gallery_items",
  {
    ...collection(),
    mediaId: mediaId("media_id").notNull(),
    altText: text("alt_text").notNull(),
    caption: text("caption"),
  },
  (t) => [
    ...order("gallery_items", t),
    length("gallery_items_alt_length", t.altText, 200),
    length("gallery_items_caption_length", t.caption, 500),
    index("gallery_items_media_idx").on(t.mediaId),
  ],
);
export const openingHours = pgTable(
  "opening_hours",
  {
    weekday: integer("weekday").primaryKey(),
    status: text("status", { enum: ["unknown", "open", "closed"] })
      .notNull()
      .default("unknown"),
    opensAt: time("opens_at", { precision: 0 }),
    closesAt: time("closes_at", { precision: 0 }),
    closesNextDay: boolean("closes_next_day").notNull().default(false),
  },
  (t) => [
    check("opening_hours_weekday_range", sql`${t.weekday} between 1 and 7`),
    check("opening_hours_status_valid", sql`${t.status} in ('unknown','open','closed')`),
    check(
      "opening_hours_state_consistent",
      sql`(${t.status} = 'open' and ${t.opensAt} is not null and ${t.closesAt} is not null) or (${t.status} in ('unknown','closed') and ${t.opensAt} is null and ${t.closesAt} is null and not ${t.closesNextDay})`,
    ),
    check(
      "opening_hours_minute_precision",
      sql`extract(second from ${t.opensAt}) = 0 and extract(second from ${t.closesAt}) = 0 and ${t.opensAt} < time '24:00' and ${t.closesAt} < time '24:00'`,
    ),
    check(
      "opening_hours_duration",
      sql`${t.status} <> 'open' or ((${t.closesAt} - ${t.opensAt}) + case when ${t.closesNextDay} then interval '24 hours' else interval '0 hours' end > interval '0 hours' and (${t.closesAt} - ${t.opensAt}) + case when ${t.closesNextDay} then interval '24 hours' else interval '0 hours' end <= interval '24 hours')`,
    ),
  ],
);
export const contactChannels = pgTable(
  "contact_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: ["phone", "whatsapp", "email", "website", "instagram"] }).notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    isVisible: boolean("is_visible").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    ...order("contact_channels", t),
    check(
      "contact_channels_kind_valid",
      sql`${t.kind} in ('phone','whatsapp','email','website','instagram')`,
    ),
    length("contact_channels_label_length", t.label, 80),
    length("contact_channels_value_length", t.value, 2048),
    check(
      "contact_channels_phone_format",
      sql`${t.kind} not in ('phone','whatsapp') or ${t.value} ~ '^[+][1-9][0-9]{7,14}$'`,
    ),
  ],
);
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    lastSeenAt: instant("last_seen_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("admin_sessions_token_unique").on(t.tokenHash),
    index("admin_sessions_expiry_idx").on(t.expiresAt),
    index("admin_sessions_user_idx").on(t.adminUserId),
    hash("admin_sessions_token_hash", t.tokenHash),
    check(
      "admin_sessions_time_order",
      sql`${t.createdAt} <= ${t.lastSeenAt} and ${t.lastSeenAt} <= ${t.expiresAt} and ${t.expiresAt} <= ${t.createdAt} + interval '8 hours'`,
    ),
  ],
);
export const mutationReceipts = pgTable(
  "mutation_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
    method: text("method", { enum: ["POST", "PUT", "DELETE"] }).notNull(),
    route: text("route").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").$type<MutationReceiptDto["responseBody"]>().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
  },
  (t) => [
    uniqueIndex("mutation_receipts_scope_unique").on(
      t.adminUserId,
      t.method,
      t.route,
      t.idempotencyKey,
    ),
    index("mutation_receipts_expiry_idx").on(t.expiresAt),
    hash("mutation_receipts_request_hash", t.requestHash),
    check("mutation_receipts_method_valid", sql`${t.method} in ('POST','PUT','DELETE')`),
    check(
      "mutation_receipts_success_status",
      sql`(${t.method} = 'POST' and ${t.responseStatus} = 201) or (${t.method} in ('PUT','DELETE') and ${t.responseStatus} = 200)`,
    ),
    check("mutation_receipts_body_object", sql`jsonb_typeof(${t.responseBody}) = 'object'`),
    check("mutation_receipts_expiry_order", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);
export const authThrottles = pgTable(
  "auth_throttles",
  {
    bucketKey: text("bucket_key").primaryKey(),
    windowStart: instant("window_start").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    blockedUntil: instant("blocked_until"),
  },
  (t) => [
    check("auth_throttles_count_nonnegative", sql`${t.attemptCount} >= 0`),
    index("auth_throttles_window_idx").on(t.windowStart),
    index("auth_throttles_blocked_idx").on(t.blockedUntil),
  ],
);
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => adminUsers.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    requestId: uuid("request_id").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    length("audit_events_action_length", t.action, 80),
    length("audit_events_resource_length", t.resourceType, 80),
    index("audit_events_created_idx").on(t.createdAt),
    index("audit_events_actor_idx").on(t.actorId),
  ],
);
