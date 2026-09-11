import { app } from "./app";

const port = Number(Bun.env.API_PORT ?? "3001");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("API_PORT must be an integer between 1 and 65535.");
}

app.listen({ hostname: Bun.env.API_HOST ?? "127.0.0.1", port });
console.info(`API listening on port ${port}`);

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await app.stop();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stop().catch(() => {
      console.error("API shutdown failed.");
      process.exitCode = 1;
    });
  });
}
