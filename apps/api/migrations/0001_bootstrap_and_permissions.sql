-- Production bootstrap contains only confirmed facts. This runs once through
-- the migration journal; conflicts never overwrite later admin edits.
INSERT INTO site_profile (id, name, region)
VALUES (1, 'UMBUL NOGO', 'Wonogiri, Jawa Tengah') ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO site_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO operations_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO opening_hours (weekday)
SELECT generate_series(1, 7) ON CONFLICT (weekday) DO NOTHING;
--> statement-breakpoint
-- Provision these roles first. The API must neither own tables nor inherit
-- the migrator. No CREATE, TRUNCATE, REFERENCES, TRIGGER or grant option.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO umbul_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  attractions, ticket_rates, facilities, gallery_items, contact_channels,
  media_assets, admin_sessions, mutation_receipts, auth_throttles TO umbul_runtime;
--> statement-breakpoint
GRANT SELECT, UPDATE ON site_profile, site_state, operations_settings, opening_hours TO umbul_runtime;
--> statement-breakpoint
-- Account provisioning is an operator action, not an HTTP capability.
GRANT SELECT ON admin_users TO umbul_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_events TO umbul_runtime;
