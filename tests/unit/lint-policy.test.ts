import { expect, test } from "bun:test";
import { ESLint } from "eslint";
import { resolve } from "node:path";

const eslint = new ESLint({ cwd: resolve(".") });
const webServer = "apps/web/src/routes/+page.server.ts";

async function ruleIds(source: string, filePath = webServer): Promise<(string | null)[]> {
  const results = await eslint.lintText(source, { filePath });
  const messages = results.flatMap((result) => result.messages);
  expect(messages.filter((message) => message.fatal)).toEqual([]);
  return messages.map((message) => message.ruleId);
}

test("ESLint menolak import, re-export, dynamic import, dan import tipe lintas aplikasi", async () => {
  for (const source of [
    'import type { App } from "@umbul-nogo/api"; export type Example = App;',
    'export * from "../../../api/src/app";',
    'export const loadApi = () => import("../../../api/src/app");',
    'export type Example = typeof import("../../../api/src/app");',
  ]) {
    expect(await ruleIds(source)).toContain("project/import-boundaries");
  }
});

test("ESLint memeriksa batas server/browser di komponen Svelte", async () => {
  expect(
    await ruleIds(
      '<script lang="ts">import { env } from "$env/dynamic/private";</script><p>{env.SECRET}</p>',
      "apps/web/src/routes/+page.svelte",
    ),
  ).toContain("project/import-boundaries");
});

test("ESLint menolak explicit any dan Promise tanpa penanganan", async () => {
  expect(await ruleIds("export const value: any = 1;")).toContain(
    "@typescript-eslint/no-explicit-any",
  );
  expect(await ruleIds('Promise.resolve("unhandled");')).toContain(
    "@typescript-eslint/no-floating-promises",
  );
});

test("ESLint menolak double assertion dan import dinamis nonliteral", async () => {
  expect(await ruleIds("export const value = 1 as unknown as string;")).toContain(
    "no-restricted-syntax",
  );
  expect(await ruleIds("export const loadModule = (name: string) => import(name);")).toContain(
    "no-restricted-syntax",
  );
});

test("ESLint menerima import kontrak browser dan environment pada server loader", async () => {
  expect(
    await ruleIds(
      'import { bootstrapSiteSchema } from "@umbul-nogo/contracts/bootstrap"; export const parse = (value: unknown) => bootstrapSiteSchema.parse(value);',
    ),
  ).toEqual([]);
  expect(
    await ruleIds(
      'import { env } from "$env/dynamic/private"; export const url = env.API_INTERNAL_URL;',
    ),
  ).toEqual([]);
});
