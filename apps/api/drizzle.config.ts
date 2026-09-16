import { defineConfig } from "drizzle-kit";

// Generating SQL must not require database credentials or a running PostgreSQL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
});
