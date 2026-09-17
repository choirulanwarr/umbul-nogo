import { databaseUrl } from "./db/client";

export type ApiConfig = {
  host: string;
  port: number;
  siteOrigin: string;
  databaseUrl: string;
  production: boolean;
};
export function readEnvironment(env: Record<string, string | undefined>): ApiConfig {
  try {
    if (env.NODE_ENV && !["development", "test", "production"].includes(env.NODE_ENV))
      throw new Error();
    const production = env.NODE_ENV === "production";
    const host = env.API_HOST ?? "127.0.0.1";
    const portText = env.API_PORT ?? "3001";
    if (
      !/^[1-9][0-9]*$/.test(portText) ||
      Number(portText) > 65535 ||
      !/^[a-zA-Z0-9.:-]+$/.test(host)
    )
      throw new Error();
    if (!env.SITE_ORIGIN) throw new Error();
    const origin = new URL(env.SITE_ORIGIN);
    if (
      origin.origin !== env.SITE_ORIGIN ||
      origin.username ||
      origin.password ||
      (production ? origin.protocol !== "https:" : !["https:", "http:"].includes(origin.protocol))
    )
      throw new Error();
    return {
      host,
      port: Number(portText),
      production,
      siteOrigin: origin.origin,
      databaseUrl: databaseUrl(env.DATABASE_URL, "umbul_runtime"),
    };
  } catch {
    throw new Error(
      "Konfigurasi API tidak sah. Periksa API_HOST, API_PORT, SITE_ORIGIN dan DATABASE_URL.",
    );
  }
}
