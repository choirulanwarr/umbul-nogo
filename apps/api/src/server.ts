import { createPasswordVerifier } from "./auth/crypto";
import { createAuthService } from "./auth/service";
import { createAuthHttp } from "./auth/http";
import { createApp } from "./app";
import { createDatabase } from "./db/client";
import { databaseServices } from "./db/health";
import { readEnvironment } from "./env";
import { MULTIPART_BODY_BYTES } from "./http/body";
import { createShutdown } from "./lifecycle";

async function start(): Promise<void> {
  const config = readEnvironment(Bun.env);
  const connection = createDatabase(config.databaseUrl);
  try {
    const sources = new WeakMap<Request, string>();
    const auth = createAuthHttp({
      service: createAuthService({
        db: connection.db,
        verifyPassword: await createPasswordVerifier(),
      }),
      siteOrigin: config.siteOrigin,
      production: config.production,
      sourceAddress: (request) => sources.get(request),
    });
    const app = createApp({
      ...auth,
      ...databaseServices(connection.db),
      log: (entry) => console.info(JSON.stringify(entry)),
    });
    const server = Bun.serve({
      hostname: config.host,
      port: config.port,
      maxRequestBodySize: MULTIPART_BODY_BYTES,
      fetch: async (request, server) => {
        const address = server.requestIP(request)?.address;
        if (address) sources.set(request, address);
        try {
          return await app.handle(request);
        } finally {
          sources.delete(request);
        }
      },
      error: () => new Response(null, { status: 500 }),
    });
    const stop = createShutdown({
      drain: () => server.stop(),
      force: () => server.stop(true),
      closeDatabase: connection.close,
    });
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, () => {
        stop().catch(() => {
          console.error(JSON.stringify({ level: "error", event: "shutdown_failed" }));
          process.exitCode = 1;
        });
      });
    }
    console.info(JSON.stringify({ level: "info", event: "api_started", port: config.port }));
  } catch (error) {
    await connection.close();
    throw error;
  }
}
try {
  await start();
} catch {
  console.error(
    JSON.stringify({
      level: "error",
      event: "startup_failed",
      message: "API gagal dimulai; periksa konfigurasi dan listener privat.",
    }),
  );
  process.exitCode = 1;
}
