import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { importViolation } from "../../scripts/import-policy";
import { checkSource } from "../../scripts/source-policy";

describe("source policy", () => {
  test("menolak semua sumber JavaScript authored", () => {
    for (const name of [
      "server.js",
      "config.mjs",
      "config.cjs",
      "component.jsx",
      "module.mts",
      "module.cts",
      "component.tsx",
    ]) {
      expect(checkSource(name, "export const value = 1;")).toHaveLength(1);
    }
  });
  test("membedakan script sungguhan dari komentar dan teks", () => {
    expect(checkSource("Page.svelte", "<!-- <script>not code</script> --><p>Konten</p>")).toEqual(
      [],
    );
    expect(
      checkSource(
        "Page.svelte",
        '<script lang="ts">const text = "<script>";</script><p>{text}</p>',
      ),
    ).toEqual([]);
  });
  test("memeriksa script instance dan module secara terpisah", () => {
    expect(
      checkSource(
        "Page.svelte",
        '<script module>export const title = "A";</script><script lang="ts">let count = 1;</script><p>{count}</p>',
      ),
    ).toHaveLength(1);
    expect(
      checkSource(
        "Page.svelte",
        '<script lang="ts" module>export const title = "A";</script><p>{title}</p>',
      ),
    ).toEqual([]);
    expect(
      checkSource("Page.svelte", "<script>let count = 1;</script><p>{count}</p>"),
    ).toHaveLength(1);
  });
  test("menolak Svelte rusak dan menerima TypeScript biasa", () => {
    expect(checkSource("Page.svelte", "<script")).toHaveLength(1);
    expect(checkSource("helper.ts", "export const value: number = 1;")).toEqual([]);
  });
});

describe("import boundaries", () => {
  const root = resolve(".");
  const violation = (file: string, specifier: string) =>
    importViolation(root, resolve(root, file), specifier);
  test("menolak import antar aplikasi melalui paket atau path relatif", () => {
    expect(violation("apps/web/src/routes/+page.ts", "../../../api/src/app")).not.toBeNull();
    expect(violation("apps/web/src/routes/+page.ts", "@umbul-nogo/api")).not.toBeNull();
    expect(violation("apps/api/src/app.ts", "../../web/src/lib/client")).not.toBeNull();
  });
  test("mengizinkan exports kontrak dan menolak jalan pintas source", () => {
    expect(violation("apps/web/src/routes/+page.ts", "@umbul-nogo/contracts/bootstrap")).toBeNull();
    expect(
      violation("apps/web/src/routes/+page.ts", "../../../../packages/contracts/src/bootstrap"),
    ).not.toBeNull();
    expect(violation("packages/contracts/src/site.ts", "./bootstrap")).toBeNull();
  });
  test("kontrak tidak membawa framework, environment, atau runtime server", () => {
    for (const specifier of [
      "node:fs",
      "bun",
      "svelte",
      "elysia",
      "drizzle-orm",
      "$env/dynamic/private",
    ]) {
      expect(violation("packages/contracts/src/site.ts", specifier)).not.toBeNull();
    }
    expect(violation("packages/contracts/src/site.ts", "zod")).toBeNull();
  });
  test("memisahkan modul server dari browser dan mengizinkan klien API web", () => {
    for (const specifier of [
      "$lib/server/api",
      "../lib/server/api",
      "../lib/client.server",
      "$env/dynamic/private",
      "node:fs",
      "fs/promises",
      "sharp",
      "$lib/server/api?raw",
      "../lib/client.server.js",
      "../../../../scripts/dev",
    ]) {
      expect(violation("apps/web/src/routes/+page.ts", specifier)).not.toBeNull();
    }
    expect(violation("apps/web/src/routes/+page.server.ts", "$env/dynamic/private")).toBeNull();
    expect(violation("apps/web/src/routes/+page.ts", "$lib/api/client")).toBeNull();
  });
});
