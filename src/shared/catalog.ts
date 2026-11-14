import { z } from "zod";

export const objectId = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, "รหัสรายการไม่ถูกต้อง");
const date = z.iso.datetime({ offset: true });
const price = z.number().int().min(1).max(100_000_000);
const code = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/);
export const versionInput = z.object({
  version: z.number().int().min(0),
  reason: z.string().trim().min(3).max(1000),
});
export const eventFields = z.object({
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(10000),
  artists: z.array(z.string().trim().min(1).max(100)).max(20),
  venue: z.string().trim().min(1).max(200),
  posterUrl: z
    .union([
      z.literal(""),
      z.string().regex(/^\/(?!\/)[A-Za-z0-9/_.-]+$/),
      z.url({ protocol: /^https$/ }),
    ])
    .optional(),
  artistImageUrl: z
    .union([
      z.literal(""),
      z.string().regex(/^\/(?!\/)[A-Za-z0-9/_.-]+$/),
      z.url({ protocol: /^https$/ }),
    ])
    .optional(),
  startsAt: date,
  endsAt: date,
  saleStartsAt: date,
  saleEndsAt: date,
  showInSlider: z.boolean().optional(),
});
export const createEventInput = eventFields.refine(
  (v) =>
    Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
    Date.parse(v.saleEndsAt) > Date.parse(v.saleStartsAt) &&
    Date.parse(v.saleEndsAt) <= Date.parse(v.endsAt),
  { message: "กรุณาตรวจสอบช่วงวันเวลา", path: ["endsAt"] },
);
export const editEventInput = eventFields
  .extend({ version: z.number().int().min(0) })
  .refine(
    (v) =>
      Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
      Date.parse(v.saleEndsAt) > Date.parse(v.saleStartsAt) &&
      Date.parse(v.saleEndsAt) <= Date.parse(v.endsAt),
    { message: "กรุณาตรวจสอบช่วงวันเวลา", path: ["endsAt"] },
  );
export const zoneInput = z.object({
  code,
  name: z.string().trim().min(1).max(100),
  sellingMode: z.enum(["TABLE", "SEAT", "GENERAL_ADMISSION"]),
  capacity: z.number().int().min(1).max(100000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#E11D48"),
});
export const unitInput = z
  .object({
    zoneId: objectId.optional(),
    code,
    name: z.string().trim().min(1).max(100),
    sellingMode: z.enum(["TABLE", "SEAT"]).default("TABLE"),
    admissionCount: z.number().int().min(1).max(20),
    priceSatang: price,
    parentUnitId: objectId.nullable().optional(),
  })
  .refine((v) => v.sellingMode !== "SEAT" || v.admissionCount === 1, {
    message: "ที่นั่งหนึ่งหน่วยมีหนึ่งสิทธิ์เข้า",
    path: ["admissionCount"],
  });
export const batchUnitInput = z.object({
  zoneId: objectId.optional(),
  newZone: z
    .object({
      code,
      name: z.string().trim().min(1).max(100),
      color: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .default("#E11D48"),
    })
    .optional(),
  sellingMode: z.enum(["TABLE", "SEAT"]).default("TABLE"),
  units: z
    .array(
      z.object({
        code,
        name: z.string().trim().min(1).max(100),
        admissionCount: z.number().int().min(1).max(20),
        priceSatang: price,
      }),
    )
    .min(1)
    .max(200),
});
export const batchPriceEditInput = z.object({
  zoneId: objectId.optional(),
  unitIds: z.array(objectId).min(1).max(500).optional(),
  priceSatang: price.optional(),
  admissionCount: z.number().int().min(1).max(20).optional(),
  reason: z.string().trim().min(3).max(1000),
  eventVersion: z.number().int().min(0),
});
export const ticketTypeInput = z
  .object({
    zoneId: objectId,
    poolId: objectId,
    code,
    name: z.string().trim().min(1).max(100),
    priceSatang: price,
    saleStartsAt: date,
    saleEndsAt: date,
  })
  .refine((v) => Date.parse(v.saleEndsAt) > Date.parse(v.saleStartsAt), {
    message: "ช่วงเวลาขายไม่ถูกต้อง",
    path: ["saleEndsAt"],
  });
export const inventoryInput = z.object({
  version: z.number().int().min(0),
  status: z.enum(["AVAILABLE", "BLOCKED"]),
  reason: z.string().min(3).max(1000),
});
export const poolInput = z.object({
  version: z.number().int().min(0),
  capacity: z.number().int().min(1).max(100000),
  reason: z.string().min(3).max(1000),
});
export const priceEditInput = z.object({
  name: z.string().trim().min(1).max(100),
  priceSatang: price,
  admissionCount: z.number().int().min(1).max(20).optional(),
  reason: z.string().trim().min(3).max(1000),
  eventVersion: z.number().int().min(0),
});
export const unitActivationInput = z.object({
  active: z.boolean(),
  eventVersion: z.number().int().min(0),
  reason: z.string().trim().min(3).max(1000),
});
// Structure deletes are only allowed on drafts; the event version fences concurrent edits.
export const structureDeleteInput = z.object({
  eventVersion: z.number().int().min(0),
});
export const zoneEditInput = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  eventVersion: z.number().int().min(0),
});
export const ticketTypeEditInput = z
  .object({
    saleStartsAt: date,
    saleEndsAt: date,
    active: z.boolean(),
    eventVersion: z.number().int().min(0),
    reason: z.string().trim().min(3).max(1000),
  })
  .refine((v) => Date.parse(v.saleEndsAt) > Date.parse(v.saleStartsAt), {
    message: "ช่วงเวลาขายไม่ถูกต้อง",
    path: ["saleEndsAt"],
  });

export const geometryObject = z.object({
  id: z.string().min(1).max(80),
  code: z.string().min(1).max(40),
  name: z.string().max(100).optional(),
  label: z.string().max(100).optional(),
  type: z.enum([
    "zone",
    "stage",
    "entrance",
    "aisle",
    "service",
    "label",
    "table",
    "seat",
  ]),
  shape: z.enum(["rect", "circle"]).default("rect"),
  x: z.number().finite().min(0),
  y: z.number().finite().min(0),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite().min(-360).max(360).default(0),
  zoneId: objectId.nullable().optional(),
  unitId: objectId.nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});
export const layoutInput = z.object({
  version: z.number().int().min(0),
  width: z.number().int().min(300).max(10000),
  height: z.number().int().min(300).max(10000),
  geometry: z.object({ objects: z.array(geometryObject).max(1000) }),
});
export type LayoutGeometry = z.infer<typeof layoutInput>["geometry"];
// Each account has exactly one access level; the stored roles array is derived from it.
export const accessLevels = ["CUSTOMER", "ADMIN", "SUPER_ADMIN"] as const;
export type AccessLevel = (typeof accessLevels)[number];
export const staffInput = z.object({
  userId: objectId,
  role: z.enum(accessLevels),
  reason: z.string().trim().min(3).max(1000),
});
export const businessInput = z.object({
  displayName: z.string().trim().min(1).max(120),
  logo: z.string().max(500).nullable().optional(),
  contact: z.record(z.string(), z.string().max(500)),
  paymentInstructions: z.record(z.string(), z.string().max(1000)),
  bookingPolicy: z.object({
    holdMinutes: z.number().int().min(1).max(60),
    reviewHours: z.number().int().min(1).max(168),
    correctionHours: z.number().int().min(1).max(168),
    terms: z.string().min(1).max(5000),
  }),
  theme: z.object({ primary: z.string().regex(/^#[0-9a-f]{6}$/i) }).optional(),
});
