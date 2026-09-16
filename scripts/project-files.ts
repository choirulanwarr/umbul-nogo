import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const generatedDirectories = new Set([
  ".git",
  "node_modules",
  ".svelte-kit",
  "build",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
]);

export async function listSourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      if (generatedDirectories.has(entry.name)) continue;
      throw new Error(`Source symlink must be reviewed explicitly: ${join(directory, entry.name)}`);
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!generatedDirectories.has(entry.name)) files.push(...(await listSourceFiles(path)));
    } else if (/\.(?:[cm]?[jt]sx?|svelte)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files.sort();
}
