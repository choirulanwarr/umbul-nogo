import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { fileURLToPath } from "node:url";
import { importViolation } from "./import-policy";

export const importBoundaries = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    docs: { description: "Enforce project workspace and server/browser import boundaries." },
    messages: { forbidden: "{{reason}}" },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const root = fileURLToPath(new URL("../", import.meta.url));
    function check(source: TSESTree.Expression | null): void {
      if (!source || source.type !== AST_NODE_TYPES.Literal || typeof source.value !== "string")
        return;
      const reason = importViolation(root, context.filename, source.value);
      if (reason) context.report({ node: source, messageId: "forbidden", data: { reason } });
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      TSImportType: (node) => check(node.source),
    };
  },
});
