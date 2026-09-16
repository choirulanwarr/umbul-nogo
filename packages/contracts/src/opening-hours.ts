import { z } from "zod";

const weekdaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);
const timeSchema = z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/);
function minutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
export const openingHourSchema = z.discriminatedUnion("status", [
  z
    .strictObject({
      weekday: weekdaySchema,
      status: z.literal("open"),
      opensAt: timeSchema,
      closesAt: timeSchema,
      closesNextDay: z.boolean(),
    })
    .superRefine((day, ctx) => {
      const duration =
        minutes(day.closesAt) - minutes(day.opensAt) + (day.closesNextDay ? 1440 : 0);
      if (duration <= 0 || duration > 1440)
        ctx.addIssue({
          code: "custom",
          path: ["closesAt"],
          message: "Durasi harus lebih dari 0 dan maksimal 24 jam.",
          params: { fieldCode: "INVALID_COMBINATION" },
        });
    }),
  z.strictObject({
    weekday: weekdaySchema,
    status: z.enum(["closed", "unknown"]),
    opensAt: z.null(),
    closesAt: z.null(),
    closesNextDay: z.literal(false),
  }),
]);
export const openingHoursSchema = z
  .array(openingHourSchema)
  .length(7)
  .superRefine((days, ctx) => {
    const seen = new Set<number>();
    days.forEach((day, index) => {
      if (seen.has(day.weekday))
        ctx.addIssue({
          code: "custom",
          path: [index, "weekday"],
          message: "Hari tidak boleh berulang.",
          params: { fieldCode: "INVALID_COMBINATION" },
        });
      seen.add(day.weekday);
      if (day.status !== "open") return;
      const previous = days.find(
        (entry) => entry.weekday === (day.weekday === 1 ? 7 : day.weekday - 1),
      );
      if (
        previous?.status === "open" &&
        previous.closesNextDay &&
        minutes(previous.closesAt) > minutes(day.opensAt)
      ) {
        ctx.addIssue({
          code: "custom",
          path: [index, "opensAt"],
          message: "Jadwal bertumpang tindih dengan hari sebelumnya.",
          params: { fieldCode: "INVALID_COMBINATION" },
        });
      }
    });
  })
  .transform((days) => [...days].sort((a, b) => a.weekday - b.weekday));
export type OpeningHourDto = z.infer<typeof openingHourSchema>;
