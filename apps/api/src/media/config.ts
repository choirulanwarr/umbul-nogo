export type MediaConfig = {
  baseUrl: string | undefined;
  storage:
    | {
        endpoint: string;
        region: string;
        bucket: string;
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        virtualHostedStyle: boolean;
      }
    | undefined;
};
export function readMediaEnvironment(env: Record<string, string | undefined>): MediaConfig {
  try {
    let baseUrl: string | undefined;
    if (env.MEDIA_BASE_URL) {
      const url = new URL(env.MEDIA_BASE_URL);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
        throw new Error();
      baseUrl = url.href.replace(/\/$/, "");
    }
    const keys = [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ] as const;
    const enabled =
      keys.some((key) => Boolean(env[key])) ||
      Boolean(env.S3_SESSION_TOKEN || env.S3_VIRTUAL_HOSTED_STYLE);
    if (!enabled) return { baseUrl, storage: undefined };
    if (!baseUrl || keys.some((key) => !env[key]?.trim())) throw new Error();
    const endpoint = new URL(env.S3_ENDPOINT!);
    if (
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname !== "/" ||
      (endpoint.protocol !== "https:" &&
        !(
          env.NODE_ENV !== "production" &&
          endpoint.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
        ))
    )
      throw new Error();
    if (
      !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.S3_BUCKET!) ||
      !/^[a-z0-9-]+$/.test(env.S3_REGION!)
    )
      throw new Error();
    if (env.S3_VIRTUAL_HOSTED_STYLE && !["true", "false"].includes(env.S3_VIRTUAL_HOSTED_STYLE))
      throw new Error();
    return {
      baseUrl,
      storage: {
        endpoint: endpoint.origin,
        region: env.S3_REGION!,
        bucket: env.S3_BUCKET!,
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
        ...(env.S3_SESSION_TOKEN ? { sessionToken: env.S3_SESSION_TOKEN } : {}),
        virtualHostedStyle: env.S3_VIRTUAL_HOSTED_STYLE === "true",
      },
    };
  } catch {
    throw new Error("Konfigurasi media tidak sah. Periksa MEDIA_BASE_URL dan konfigurasi S3.");
  }
}
