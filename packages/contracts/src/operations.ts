import { z } from "zod";
import { contentResponseSchema, mutationResponseSchema } from "./envelopes";
import {
  contentVersionSchema,
  emailSchema,
  moneyIdrSchema,
  phoneSchema,
  textSchema,
} from "./primitives";
export const operationsFieldsSchema = z.strictObject({
  monthlyBudgetIdr: moneyIdrSchema.nullable(),
  destinationManagerName: textSchema(120).nullable(),
  destinationManagerPhone: phoneSchema.nullable(),
  destinationManagerEmail: emailSchema.nullable(),
  technicalOperatorName: textSchema(120).nullable(),
  technicalOperatorPhone: phoneSchema.nullable(),
  technicalOperatorEmail: emailSchema.nullable(),
  internalNotes: textSchema(2000).nullable(),
});
export const operationsRequestSchema = operationsFieldsSchema.extend({
  expectedContentVersion: contentVersionSchema,
});
export const operationsResponseSchema = contentResponseSchema(operationsFieldsSchema);
export const operationsMutationResponseSchema = mutationResponseSchema(operationsFieldsSchema);
export type OperationsFields = z.infer<typeof operationsFieldsSchema>;
export type OperationsRequest = z.input<typeof operationsRequestSchema>;
