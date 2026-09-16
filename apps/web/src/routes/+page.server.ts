import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import { bootstrapResponseSchema } from "@umbul-nogo/contracts/bootstrap";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
  setHeaders({ "cache-control": "no-store" });

  try {
    const response = await fetch(
      new URL("/internal/bootstrap", env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"),
      { signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) throw new Error("Bootstrap API unavailable.");
    const payload: unknown = await response.json();
    return { site: bootstrapResponseSchema.parse(payload).data };
  } catch {
    error(503, "Informasi sementara tidak dapat dimuat. Silakan coba kembali.");
  }
};
