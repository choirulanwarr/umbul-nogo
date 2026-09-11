import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { listSourceFiles } from "./project-files";
import { checkSource } from "./source-policy";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = await listSourceFiles(root);
const failures: string[] = [];
for (const path of files) {
  for (const message of checkSource(path, await Bun.file(path).text())) {
    failures.push(`${relative(root, path)}: ${message}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.info(`Source policy passed for ${files.length} authored source files.`);
}
