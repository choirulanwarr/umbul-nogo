import { sha256 } from "../auth/crypto";

// Only normalized schema output / explicit JSON projections belong here.
// Serializing sorted entries directly also sorts integer-like object keys.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index)))
      throw new TypeError("Expected dense JSON array without extra properties.");
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null)
  ) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  throw new TypeError("Expected finite JSON values.");
}
export const intentHash = (value: unknown) => sha256(canonicalJson(value));
