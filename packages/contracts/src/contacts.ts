import { z } from "zod";
import {
  emailSchema,
  httpsUrlSchema,
  instagramUrlSchema,
  phoneSchema,
  textSchema,
  uuidSchema,
} from "./primitives";

export const contactKindSchema = z.enum(["phone", "whatsapp", "email", "website", "instagram"]);
const contactValues = {
  phone: phoneSchema,
  whatsapp: phoneSchema,
  email: emailSchema,
  website: httpsUrlSchema,
  instagram: instagramUrlSchema,
};
export const contactInputSchema = z
  .strictObject({
    id: uuidSchema.nullable(),
    kind: contactKindSchema,
    label: textSchema(80),
    value: textSchema(2048),
    isVisible: z.boolean(),
  })
  .superRefine((contact, ctx) => {
    if (!contactValues[contact.kind].safeParse(contact.value).success)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Nilai kontak tidak sesuai jenisnya.",
        params: { fieldCode: "INVALID_FORMAT" },
      });
  });
export const contactDtoSchema = contactInputSchema.safeExtend({ id: uuidSchema });
export const contactsInputSchema = z.array(contactInputSchema).superRefine((contacts, ctx) => {
  const seen = new Set<string>();
  contacts.forEach((contact, index) => {
    if (contact.id === null) return;
    if (seen.has(contact.id))
      ctx.addIssue({
        code: "custom",
        path: [index, "id"],
        message: "ID kontak tidak boleh berulang.",
        params: { fieldCode: "INVALID_COMBINATION" },
      });
    seen.add(contact.id);
  });
});
export const contactsDtoSchema = z
  .array(contactDtoSchema)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "ID kontak harus unik.",
  );
export const publicContactSchema = z
  .strictObject({
    id: uuidSchema,
    kind: contactKindSchema,
    label: textSchema(80),
    href: textSchema(2055),
  })
  .superRefine((contact, ctx) => {
    const { kind, href } = contact;
    const valid =
      kind === "phone"
        ? href.startsWith("tel:") && phoneSchema.safeParse(href.slice(4)).success
        : kind === "whatsapp"
          ? /^https:\/\/wa\.me\/[1-9][0-9]{7,14}$/.test(href)
          : kind === "email"
            ? href.startsWith("mailto:") && emailSchema.safeParse(href.slice(7)).success
            : contactValues[kind].safeParse(href).success;
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["href"],
        message: "Tautan kontak tidak sesuai jenisnya.",
      });
  });
export type ContactKind = z.infer<typeof contactKindSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
export type ContactDto = z.infer<typeof contactDtoSchema>;
