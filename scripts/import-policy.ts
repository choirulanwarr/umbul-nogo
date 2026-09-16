import { dirname, isAbsolute, relative, resolve } from "node:path";
import { isBuiltin } from "node:module";

export function importViolation(root: string, filename: string, specifier: string): string | null {
  const file = relative(root, filename).replaceAll("\\", "/");
  const isWeb = file.startsWith("apps/web/");
  const isApi = file.startsWith("apps/api/");
  const isContract = file.startsWith("packages/contracts/");
  if (!isWeb && !isApi && !isContract) return null;

  // Query suffixes do not change ownership (for example a Vite ?raw import).
  specifier = specifier.split(/[?#]/, 1)[0] ?? specifier;

  let target: string | null = null;
  if (specifier.startsWith(".") || isAbsolute(specifier)) {
    target = relative(root, resolve(dirname(filename), specifier)).replaceAll("\\", "/");
  } else if (specifier === "$lib" || specifier.startsWith("$lib/")) {
    target = relative(root, resolve(root, "apps/web/src/lib", specifier.slice(5))).replaceAll(
      "\\",
      "/",
    );
  }
  const webTarget = target?.startsWith("apps/web/") || /^@umbul-nogo\/web(?:\/|$)/.test(specifier);
  const apiTarget = target?.startsWith("apps/api/") || /^@umbul-nogo\/api(?:\/|$)/.test(specifier);

  if ((isWeb && apiTarget) || (isApi && webTarget) || (isContract && (webTarget || apiTarget))) {
    return "Workspace ini tidak boleh mengimpor workspace aplikasi lain secara langsung.";
  }
  if (target?.startsWith("packages/contracts/") && !isContract) {
    return "Import kontrak harus melalui exports @umbul-nogo/contracts/*.";
  }
  const ownDirectory = isWeb ? "apps/web/" : isApi ? "apps/api/" : "packages/contracts/";
  if (target !== null && !target.startsWith(ownDirectory)) {
    return "Import path lokal harus tetap di workspace sendiri; gunakan exports paket untuk kontrak.";
  }
  if (isWeb && /^(elysia|drizzle-orm|drizzle-kit|sharp)(?:\/|$)/.test(specifier)) {
    return "Web tidak boleh mengimpor runtime API, database, atau pemrosesan storage.";
  }
  if (isContract) {
    const allowed = target?.startsWith("packages/contracts/") || /^zod(?:\/|$)/.test(specifier);
    if (!allowed)
      return "Contracts hanya boleh import modul sendiri dan Zod; tidak boleh membawa runtime aplikasi.";
  }
  const serverWeb =
    !file.startsWith("apps/web/src/") ||
    file.startsWith("apps/web/src/lib/server/") ||
    /\.server\.[cm]?ts$/.test(file);
  if (isWeb && !serverWeb) {
    if (
      isBuiltin(specifier) ||
      /^(node:|bun(?::|$)|\$env\/(?:static|dynamic)\/private|\$app\/env\/private)/.test(
        specifier,
      ) ||
      specifier === "$app/server" ||
      target?.includes("/server/") ||
      /\.server(?:\.[cm]?[jt]s)?$/.test(target ?? "")
    ) {
      return "Modul browser/universal tidak boleh import modul atau environment privat server.";
    }
  }
  return null;
}
