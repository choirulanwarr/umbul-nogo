import { failure } from "../http/errors";
export const ABSOLUTE_SESSION_MS = 8 * 60 * 60 * 1000;
export const IDLE_SESSION_MS = 30 * 60 * 1000;
export const sessionCookieName = (production: boolean) =>
  production ? "__Host-umbul_session" : "umbul_session_dev";
export function readSessionToken(request: Request, production: boolean): string | undefined {
  const name = sessionCookieName(production);
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length > 1) throw failure("INVALID_REQUEST");
  const token = values[0]?.slice(name.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
export function sessionCookie(token: string | undefined, production: boolean): string {
  return `${sessionCookieName(production)}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? ABSOLUTE_SESSION_MS / 1000 : 0}${production ? "; Secure" : ""}`;
}
