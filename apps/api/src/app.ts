import { Elysia } from "elysia";
import { bootstrapResponseSchema } from "@umbul-nogo/contracts/bootstrap";

export const app = new Elysia().get("/internal/bootstrap", ({ set }) => {
  set.headers["cache-control"] = "no-store";

  // Only the identity confirmed by the user is available before T-04/T-14.
  return bootstrapResponseSchema.parse({
    success: true,
    data: { name: "UMBUL NOGO", region: "Wonogiri, Jawa Tengah" },
    meta: { requestId: crypto.randomUUID() },
  });
});
