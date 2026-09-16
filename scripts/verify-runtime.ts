import assert from "node:assert/strict";
import type { Subprocess } from "bun";

const apiPort = 4184;
const webPort = 4183;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;

async function waitFor(url: string, child: Subprocess): Promise<Response> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Service exited: ${child.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response;
    } catch {
      // Only startup connection failures are retried, within the bounded deadline.
    }
    await Bun.sleep(100);
  }
  throw new Error("Service did not become ready within 15 seconds.");
}

async function stop(child: Subprocess): Promise<number> {
  if (child.exitCode !== null) return child.exitCode;
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    return await child.exited;
  } finally {
    clearTimeout(timer);
  }
}

const api = Bun.spawn([process.execPath, "dist/server.js"], {
  cwd: new URL("../apps/api/", import.meta.url).pathname,
  env: { ...Bun.env, NODE_ENV: "production", API_HOST: "127.0.0.1", API_PORT: String(apiPort) },
  stdout: "inherit",
  stderr: "inherit",
});
let web: Subprocess | undefined;

try {
  const response = await waitFor(`${apiOrigin}/internal/bootstrap`, api);
  const payload: unknown = await response.json();
  assert(payload && typeof payload === "object" && "data" in payload);
  assert.deepEqual(payload.data, { name: "UMBUL NOGO", region: "Wonogiri, Jawa Tengah" });

  web = Bun.spawn([process.execPath, "build/index.js"], {
    cwd: new URL("../apps/web/", import.meta.url).pathname,
    env: {
      ...Bun.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(webPort),
      ORIGIN: webOrigin,
      API_INTERNAL_URL: apiOrigin,
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  const page = await waitFor(webOrigin, web);
  const html = await page.text();
  assert(html.includes("UMBUL NOGO"));
  assert(html.includes("Informasi harga tiket belum tersedia."));
  assert(!html.includes(apiOrigin), "Internal API origin must not enter page data.");
  assert.equal(page.headers.get("cache-control"), "no-store");

  const apiExitCode = await stop(api);
  assert.equal(apiExitCode, 0, "API must shut down cleanly on SIGTERM.");
  const failedPage = await fetch(webOrigin, { signal: AbortSignal.timeout(5000) });
  assert.equal(failedPage.status, 503);
  const failedHtml = await failedPage.text();
  assert(failedHtml.includes("Informasi belum dapat dimuat"));
  assert(!failedHtml.includes("Informasi harga tiket belum tersedia."));
  assert.equal(failedPage.headers.get("cache-control"), "no-store");
  const webExitCode = await stop(web);
  assert.equal(webExitCode, 0, "Web must shut down cleanly on SIGTERM.");
  console.info(
    JSON.stringify({
      check: "production-runtime",
      result: "passed",
      platform: process.platform,
      arch: process.arch,
      bun: Bun.version,
      apiExitCode,
      webExitCode,
      unavailableApiStatus: failedPage.status,
    }),
  );
} finally {
  await stop(api);
  if (web) await stop(web);
}
