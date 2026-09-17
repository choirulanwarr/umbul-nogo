import { createHash, randomBytes } from "node:crypto";
import { loginRequestSchema } from "@umbul-nogo/contracts/auth";

export const ARGON2_OPTIONS = { algorithm: "argon2id", memoryCost: 65_536, timeCost: 2 } as const;
export const newSessionToken = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(loginRequestSchema.shape.password.parse(password), ARGON2_OPTIONS);
}
export async function createPasswordVerifier() {
  // Missing accounts still pay one Argon2 verification; this is not an account.
  const dummyHash = await hashPassword(newSessionToken());
  return (password: string, hash: string | undefined) =>
    Bun.password.verify(password, hash ?? dummyHash, "argon2id");
}
