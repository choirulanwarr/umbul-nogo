CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_sessions_token_hash" CHECK ("admin_sessions"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "admin_sessions_time_order" CHECK ("admin_sessions"."created_at" <= "admin_sessions"."last_seen_at" and "admin_sessions"."last_seen_at" <= "admin_sessions"."expires_at" and "admin_sessions"."expires_at" <= "admin_sessions"."created_at" + interval '8 hours')
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_length" CHECK (char_length(btrim("admin_users"."email")) between 1 and 254),
	CONSTRAINT "admin_users_email_normalized" CHECK ("admin_users"."email" = lower(btrim("admin_users"."email"))),
	CONSTRAINT "admin_users_password_argon2id" CHECK ("admin_users"."password_hash" like '$argon2id$%')
);
--> statement-breakpoint
CREATE TABLE "attractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_visible" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"media_id" uuid,
	"image_alt" text,
	CONSTRAINT "attractions_sort_nonnegative" CHECK ("attractions"."sort_order" >= 0),
	CONSTRAINT "attractions_name_length" CHECK (char_length(btrim("attractions"."name")) between 1 and 120),
	CONSTRAINT "attractions_description_length" CHECK (char_length(btrim("attractions"."description")) between 1 and 3000),
	CONSTRAINT "attractions_alt_length" CHECK (char_length(btrim("attractions"."image_alt")) between 1 and 200),
	CONSTRAINT "attractions_visible_complete" CHECK (not "attractions"."is_visible" or "attractions"."description" is not null),
	CONSTRAINT "attractions_media_paired" CHECK (("attractions"."media_id" is null) = ("attractions"."image_alt" is null))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_action_length" CHECK (char_length(btrim("audit_events"."action")) between 1 and 80),
	CONSTRAINT "audit_events_resource_length" CHECK (char_length(btrim("audit_events"."resource_type")) between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "auth_throttles" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	CONSTRAINT "auth_throttles_count_nonnegative" CHECK ("auth_throttles"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "contact_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"is_visible" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "contact_channels_sort_nonnegative" CHECK ("contact_channels"."sort_order" >= 0),
	CONSTRAINT "contact_channels_kind_valid" CHECK ("contact_channels"."kind" in ('phone','whatsapp','email','website','instagram')),
	CONSTRAINT "contact_channels_label_length" CHECK (char_length(btrim("contact_channels"."label")) between 1 and 80),
	CONSTRAINT "contact_channels_value_length" CHECK (char_length(btrim("contact_channels"."value")) between 1 and 2048),
	CONSTRAINT "contact_channels_phone_format" CHECK ("contact_channels"."kind" not in ('phone','whatsapp') or "contact_channels"."value" ~ '^[+][1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_visible" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "facilities_sort_nonnegative" CHECK ("facilities"."sort_order" >= 0),
	CONSTRAINT "facilities_name_length" CHECK (char_length(btrim("facilities"."name")) between 1 and 100),
	CONSTRAINT "facilities_description_length" CHECK (char_length(btrim("facilities"."description")) between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_visible" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"media_id" uuid NOT NULL,
	"alt_text" text NOT NULL,
	"caption" text,
	CONSTRAINT "gallery_items_sort_nonnegative" CHECK ("gallery_items"."sort_order" >= 0),
	CONSTRAINT "gallery_items_alt_length" CHECK (char_length(btrim("gallery_items"."alt_text")) between 1 and 200),
	CONSTRAINT "gallery_items_caption_length" CHECK (char_length(btrim("gallery_items"."caption")) between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"upload_key" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"source_sha256" text NOT NULL,
	"attempt_id" uuid,
	"lease_until" timestamp with time zone,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_assets_source_hash" CHECK ("media_assets"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "media_assets_status_valid" CHECK ("media_assets"."status" in ('processing','ready','failed','deleting','deleted')),
	CONSTRAINT "media_assets_failure_valid" CHECK ("media_assets"."failure_code" in ('IMAGE_INVALID','STORAGE_UNAVAILABLE','UPLOAD_INTERRUPTED')),
	CONSTRAINT "media_assets_manifest_array" CHECK (jsonb_typeof("media_assets"."variants") = 'array'),
	CONSTRAINT "media_assets_ready_manifest" CHECK ("media_assets"."status" <> 'ready' or (jsonb_array_length("media_assets"."variants") > 0 and "media_assets"."failure_code" is null)),
	CONSTRAINT "media_assets_deleted_timestamp" CHECK (("media_assets"."status" = 'deleted') = ("media_assets"."deleted_at" is not null)),
	CONSTRAINT "media_assets_lease_attempt" CHECK ("media_assets"."lease_until" is null or "media_assets"."attempt_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "mutation_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mutation_receipts_request_hash" CHECK ("mutation_receipts"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "mutation_receipts_method_valid" CHECK ("mutation_receipts"."method" in ('POST','PUT','DELETE')),
	CONSTRAINT "mutation_receipts_success_status" CHECK (("mutation_receipts"."method" = 'POST' and "mutation_receipts"."response_status" = 201) or ("mutation_receipts"."method" in ('PUT','DELETE') and "mutation_receipts"."response_status" = 200)),
	CONSTRAINT "mutation_receipts_body_object" CHECK (jsonb_typeof("mutation_receipts"."response_body") = 'object'),
	CONSTRAINT "mutation_receipts_expiry_order" CHECK ("mutation_receipts"."expires_at" > "mutation_receipts"."created_at")
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"opens_at" time(0),
	"closes_at" time(0),
	"closes_next_day" boolean DEFAULT false NOT NULL,
	CONSTRAINT "opening_hours_weekday_range" CHECK ("opening_hours"."weekday" between 1 and 7),
	CONSTRAINT "opening_hours_status_valid" CHECK ("opening_hours"."status" in ('unknown','open','closed')),
	CONSTRAINT "opening_hours_state_consistent" CHECK (("opening_hours"."status" = 'open' and "opening_hours"."opens_at" is not null and "opening_hours"."closes_at" is not null) or ("opening_hours"."status" in ('unknown','closed') and "opening_hours"."opens_at" is null and "opening_hours"."closes_at" is null and not "opening_hours"."closes_next_day")),
	CONSTRAINT "opening_hours_minute_precision" CHECK (extract(second from "opening_hours"."opens_at") = 0 and extract(second from "opening_hours"."closes_at") = 0 and "opening_hours"."opens_at" < time '24:00' and "opening_hours"."closes_at" < time '24:00'),
	CONSTRAINT "opening_hours_duration" CHECK ("opening_hours"."status" <> 'open' or (("opening_hours"."closes_at" - "opening_hours"."opens_at") + case when "opening_hours"."closes_next_day" then interval '24 hours' else interval '0 hours' end > interval '0 hours' and ("opening_hours"."closes_at" - "opening_hours"."opens_at") + case when "opening_hours"."closes_next_day" then interval '24 hours' else interval '0 hours' end <= interval '24 hours'))
);
--> statement-breakpoint
CREATE TABLE "operations_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"monthly_budget_idr" integer,
	"destination_manager_name" text,
	"destination_manager_phone" text,
	"destination_manager_email" text,
	"technical_operator_name" text,
	"technical_operator_phone" text,
	"technical_operator_email" text,
	"internal_notes" text,
	CONSTRAINT "operations_settings_singleton" CHECK ("operations_settings"."id" = 1),
	CONSTRAINT "operations_settings_budget_nonnegative" CHECK ("operations_settings"."monthly_budget_idr" >= 0),
	CONSTRAINT "operations_manager_name_length" CHECK (char_length(btrim("operations_settings"."destination_manager_name")) between 1 and 120),
	CONSTRAINT "operations_operator_name_length" CHECK (char_length(btrim("operations_settings"."technical_operator_name")) between 1 and 120),
	CONSTRAINT "operations_manager_email_length" CHECK (char_length(btrim("operations_settings"."destination_manager_email")) between 1 and 254),
	CONSTRAINT "operations_operator_email_length" CHECK (char_length(btrim("operations_settings"."technical_operator_email")) between 1 and 254),
	CONSTRAINT "operations_notes_length" CHECK (char_length(btrim("operations_settings"."internal_notes")) between 1 and 2000),
	CONSTRAINT "operations_manager_phone_format" CHECK ("operations_settings"."destination_manager_phone" ~ '^[+][1-9][0-9]{7,14}$'),
	CONSTRAINT "operations_operator_phone_format" CHECK ("operations_settings"."technical_operator_phone" ~ '^[+][1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "site_profile" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"introduction" text,
	"region" text NOT NULL,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"map_url" text,
	"visit_notes" text,
	"hero_media_id" uuid,
	"hero_alt" text,
	"logo_media_id" uuid,
	"seo_title" text,
	"seo_description" text,
	"seo_media_id" uuid,
	CONSTRAINT "site_profile_singleton" CHECK ("site_profile"."id" = 1),
	CONSTRAINT "site_profile_name_length" CHECK (char_length(btrim("site_profile"."name")) between 1 and 120),
	CONSTRAINT "site_profile_region_length" CHECK (char_length(btrim("site_profile"."region")) between 1 and 160),
	CONSTRAINT "site_profile_introduction_length" CHECK (char_length(btrim("site_profile"."introduction")) between 1 and 2000),
	CONSTRAINT "site_profile_address_length" CHECK (char_length(btrim("site_profile"."address")) between 1 and 1000),
	CONSTRAINT "site_profile_notes_length" CHECK (char_length(btrim("site_profile"."visit_notes")) between 1 and 3000),
	CONSTRAINT "site_profile_hero_alt_length" CHECK (char_length(btrim("site_profile"."hero_alt")) between 1 and 200),
	CONSTRAINT "site_profile_seo_title_length" CHECK (char_length(btrim("site_profile"."seo_title")) between 1 and 120),
	CONSTRAINT "site_profile_seo_description_length" CHECK (char_length(btrim("site_profile"."seo_description")) between 1 and 320),
	CONSTRAINT "site_profile_map_length" CHECK (char_length(btrim("site_profile"."map_url")) between 1 and 2048),
	CONSTRAINT "site_profile_coordinates_paired" CHECK (("site_profile"."latitude" is null) = ("site_profile"."longitude" is null)),
	CONSTRAINT "site_profile_latitude_range" CHECK ("site_profile"."latitude" between -90 and 90),
	CONSTRAINT "site_profile_longitude_range" CHECK ("site_profile"."longitude" between -180 and 180),
	CONSTRAINT "site_profile_hero_paired" CHECK (("site_profile"."hero_media_id" is null) = ("site_profile"."hero_alt" is null))
);
--> statement-breakpoint
CREATE TABLE "site_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"content_version" bigint DEFAULT 0 NOT NULL,
	"public_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tickets_updated_at" timestamp with time zone,
	CONSTRAINT "site_state_singleton" CHECK ("site_state"."id" = 1),
	CONSTRAINT "site_state_version_safe" CHECK ("site_state"."content_version" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "ticket_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_visible" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"price_idr" integer NOT NULL,
	"unit" text NOT NULL,
	"terms" text NOT NULL,
	"applicability_note" text,
	CONSTRAINT "ticket_rates_sort_nonnegative" CHECK ("ticket_rates"."sort_order" >= 0),
	CONSTRAINT "ticket_rates_price_nonnegative" CHECK ("ticket_rates"."price_idr" >= 0),
	CONSTRAINT "ticket_rates_name_length" CHECK (char_length(btrim("ticket_rates"."name")) between 1 and 100),
	CONSTRAINT "ticket_rates_unit_length" CHECK (char_length(btrim("ticket_rates"."unit")) between 1 and 60),
	CONSTRAINT "ticket_rates_terms_length" CHECK (char_length(btrim("ticket_rates"."terms")) between 1 and 3000),
	CONSTRAINT "ticket_rates_note_length" CHECK (char_length(btrim("ticket_rates"."applicability_note")) between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attractions" ADD CONSTRAINT "attractions_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_id_admin_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_profile" ADD CONSTRAINT "site_profile_hero_media_id_media_assets_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_profile" ADD CONSTRAINT "site_profile_logo_media_id_media_assets_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_profile" ADD CONSTRAINT "site_profile_seo_media_id_media_assets_id_fk" FOREIGN KEY ("seo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_unique" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_expiry_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "admin_sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "attractions_public_order_idx" ON "attractions" USING btree ("is_visible","sort_order","id");--> statement-breakpoint
CREATE INDEX "attractions_media_idx" ON "attractions" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "auth_throttles_window_idx" ON "auth_throttles" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "auth_throttles_blocked_idx" ON "auth_throttles" USING btree ("blocked_until");--> statement-breakpoint
CREATE INDEX "contact_channels_public_order_idx" ON "contact_channels" USING btree ("is_visible","sort_order","id");--> statement-breakpoint
CREATE INDEX "facilities_public_order_idx" ON "facilities" USING btree ("is_visible","sort_order","id");--> statement-breakpoint
CREATE INDEX "gallery_items_public_order_idx" ON "gallery_items" USING btree ("is_visible","sort_order","id");--> statement-breakpoint
CREATE INDEX "gallery_items_media_idx" ON "gallery_items" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_upload_unique" ON "media_assets" USING btree ("uploader_id","upload_key");--> statement-breakpoint
CREATE INDEX "media_assets_lease_idx" ON "media_assets" USING btree ("status","lease_until");--> statement-breakpoint
CREATE INDEX "media_assets_library_idx" ON "media_assets" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "media_assets_status_library_idx" ON "media_assets" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "mutation_receipts_scope_unique" ON "mutation_receipts" USING btree ("admin_user_id","method","route","idempotency_key");--> statement-breakpoint
CREATE INDEX "mutation_receipts_expiry_idx" ON "mutation_receipts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ticket_rates_public_order_idx" ON "ticket_rates" USING btree ("is_visible","sort_order","id");