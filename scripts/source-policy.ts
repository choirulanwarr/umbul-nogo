import { parse } from "svelte/compiler";

export function checkSource(path: string, source: string): string[] {
  if (/\.(?:[cm]?js|jsx)$/.test(path)) return ["Sumber JavaScript authored tidak diizinkan."];
  if (!path.endsWith(".ts") && !path.endsWith(".svelte")) {
    return ["Gunakan ekstensi .ts atau .svelte yang tercakup dalam lint dan typecheck proyek."];
  }
  if (!path.endsWith(".svelte")) return [];
  try {
    const ast = parse(source, { modern: true });
    const failures: string[] = [];
    for (const script of [ast.instance, ast.module]) {
      if (!script) continue;
      const lang = script.attributes.find(
        (attribute) => attribute.type === "Attribute" && attribute.name === "lang",
      );
      const value = lang?.type === "Attribute" && Array.isArray(lang.value) ? lang.value : [];
      if (value.length !== 1 || value[0]?.type !== "Text" || value[0].data !== "ts") {
        failures.push(`Script ${script.context} harus memakai lang="ts".`);
      }
    }
    return failures;
  } catch {
    return ["Komponen Svelte tidak dapat diparse; perbaiki sintaks sebelum melanjutkan."];
  }
}
