import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "รหัสรายการไม่ถูกต้อง");
export const createBookingSchema = z
  .object({
    eventId: objectIdSchema,
    items: z
      .array(
        z
          .object({
            unitId: objectIdSchema.optional(),
            ticketTypeId: objectIdSchema.optional(),
            quantity: z.number().int().min(1).max(20),
          })
          .strict()
          .refine(
            (value) => Boolean(value.unitId) !== Boolean(value.ticketTypeId),
            "ต้องเลือกหน่วยขายหรือประเภทบัตรอย่างใดอย่างหนึ่ง",
          ),
      )
      .min(1)
      .max(20),
  })
  .strict();
export const paymentSchema = z
  .object({
    assetId: objectIdSchema,
    declaredAmountSatang: z.number().int().positive().max(100_000_000),
    transferTime: z.string().datetime({ offset: true }),
  })
  .strict();
export const actionSchema = z
  .object({
    version: z.number().int().min(0),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export const approvalSchema = actionSchema
  .extend({
    paymentAttemptId: objectIdSchema,
    receivedAmountSatang: z.number().int().positive().max(100_000_000),
  })
  .strict();
export const lateReceiptSchema = actionSchema
  .extend(paymentSchema.shape)
  .strict();
export const completeRefundSchema = z
  .object({
    proofAssetId: objectIdSchema,
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export const checkInSchema = z
  .object({
    eventId: objectIdSchema,
    token: z
      .string()
      .trim()
      .min(6, "รหัสบัตรไม่ถูกต้อง")
      .max(300, "รหัสบัตรไม่ถูกต้อง"),
  })
  .strict();
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ActionInput = z.infer<typeof actionSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type CompleteRefundInput = z.infer<typeof completeRefundSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
