import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/auth";
import { invariant } from "@/server/errors";
import { requireRoles } from "@/server/permissions";
import { idempotent } from "./idempotency";
import { audit } from "./event-admin";
import { layoutInput, type LayoutGeometry } from "@/shared/catalog";

export async function getDraftLayout(eventId: string) {
  const draft = await prisma.layoutTemplate.findUnique({ where: { eventId } });
  invariant(draft, "NOT_FOUND", "ไม่พบร่างผัง", 404);
  return { ...draft, version: draft.revision };
}
export async function validateGeometry(
  tx: Prisma.TransactionClient,
  eventId: string,
  input: z.infer<typeof layoutInput>,
  publishing = false,
) {
  const [zones, units] = await Promise.all([
    tx.zone.findMany({ where: { eventId } }),
    tx.bookableUnit.findMany({ where: { eventId, active: true } }),
  ]);
  const zoneMap = new Map(zones.map((x) => [x.id, x]));
  const unitMap = new Map(units.map((x) => [x.id, x]));
  const ids = new Set<string>(),
    codes = new Set<string>(),
    linkedUnits = new Set<string>();
  const warnings: string[] = [];
  for (const obj of input.geometry.objects) {
    invariant(
      !ids.has(obj.id) && !codes.has(obj.code),
      "VALIDATION_ERROR",
      "รหัสวัตถุหรือชื่อรหัสซ้ำกัน",
      422,
    );
    ids.add(obj.id);
    codes.add(obj.code);
    const radians = (obj.rotation * Math.PI) / 180;
    const corners = [
      [0, 0],
      [obj.width, 0],
      [0, obj.height],
      [obj.width, obj.height],
    ].map(([x, y]) => ({
      x: obj.x + x * Math.cos(radians) - y * Math.sin(radians),
      y: obj.y + x * Math.sin(radians) + y * Math.cos(radians),
    }));
    invariant(
      corners.every(
        (p) =>
          p.x >= -0.01 &&
          p.y >= -0.01 &&
          p.x <= input.width + 0.01 &&
          p.y <= input.height + 0.01,
      ),
      "VALIDATION_ERROR",
      `วัตถุ ${obj.code} อยู่นอกขอบผัง`,
      422,
    );
    if (obj.zoneId)
      invariant(
        zoneMap.has(obj.zoneId),
        "VALIDATION_ERROR",
        `โซนของ ${obj.code} ไม่อยู่ในงานนี้`,
        422,
      );
    if (["table", "seat"].includes(obj.type)) {
      invariant(
        obj.unitId,
        "VALIDATION_ERROR",
        `กรุณาผูก ${obj.code} กับหน่วยขายโต๊ะจริง`,
        422,
      );
      const unit = unitMap.get(obj.unitId);
      invariant(
        unit && unit.sellingMode === obj.type.toUpperCase(),
        "VALIDATION_ERROR",
        `หน่วยขาย ${obj.code} ไม่ตรงกับประเภท`,
        422,
      );
      obj.zoneId = unit.zoneId;
      invariant(
        !linkedUnits.has(unit.id),
        "VALIDATION_ERROR",
        "หน่วยขายหนึ่งหน่วยต้องมีวัตถุเดียวในผัง",
        422,
      );
      linkedUnits.add(unit.id);
    } else
      invariant(
        !obj.unitId,
        "VALIDATION_ERROR",
        "วัตถุประกอบไม่สามารถอ้างหน่วยขาย",
        422,
      );
    if (obj.type === "zone")
      invariant(obj.zoneId, "VALIDATION_ERROR", "กรุณากำหนดโซน", 422);
  }
  const objects = input.geometry.objects.filter((o) =>
    ["table", "seat", "stage"].includes(o.type),
  );
  for (let i = 0; i < objects.length; i++)
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i],
        b = objects[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      )
        warnings.push(`${a.code} อาจซ้อนทับ ${b.code}`);
    }
  if (publishing)
    invariant(
      units.every((u) => linkedUnits.has(u.id)),
      "VALIDATION_ERROR",
      "กรุณาเพิ่มหน่วยขายทุกหน่วยลงในผังก่อนเผยแพร่",
      422,
    );
  const booked = await tx.bookingItem.findMany({
    where: { booking: { eventId }, unitId: { not: null } },
    select: { unitId: true },
  });
  const event = await tx.event.findUnique({
    where: { id: eventId },
    include: { publishedLayoutVersion: true },
  });
  const previous = event?.publishedLayoutVersion?.geometry as
    LayoutGeometry | undefined;
  for (const bookedUnit of booked) {
    const old = previous?.objects.find((o) => o.unitId === bookedUnit.unitId);
    if (old)
      invariant(
        input.geometry.objects.some(
          (o) => o.id === old.id && o.unitId === old.unitId,
        ),
        "INVALID_TRANSITION",
        "ห้ามลบหรือเปลี่ยนรหัสหน่วยที่มีประวัติการจอง",
      );
  }
  return warnings.slice(0, 100);
}
export async function saveLayout(
  actor: Actor,
  eventId: string,
  input: z.infer<typeof layoutInput>,
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `layout:save:${eventId}`,
    key,
    input,
    async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      invariant(
        event && !["CANCELLED", "COMPLETED"].includes(event.status),
        "INVALID_TRANSITION",
        "งานนี้ไม่สามารถแก้ไขผังได้",
      );
      const fence = await tx.event.updateMany({
        where: { id: eventId, version: event.version },
        data: { version: { increment: 1 } },
      });
      invariant(
        fence.count === 1,
        "VERSION_CONFLICT",
        "งานเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      const warnings = await validateGeometry(tx, eventId, input);
      const result = await tx.layoutTemplate.updateMany({
        where: { eventId, revision: input.version },
        data: {
          width: input.width,
          height: input.height,
          geometry: input.geometry,
          revision: { increment: 1 },
        },
      });
      invariant(
        result.count === 1,
        "VERSION_CONFLICT",
        "ผังถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดใหม่",
      );
      const draft = await tx.layoutTemplate.findUniqueOrThrow({
        where: { eventId },
      });
      await audit(tx, actor.id, "LAYOUT_SAVE", "LayoutTemplate", draft.id);
      return { ...draft, version: draft.revision, warnings };
    },
  );
}
export async function publishLayout(
  actor: Actor,
  eventId: string,
  input: { version: number },
  key: string,
) {
  requireRoles(actor, "ADMIN");
  return idempotent(
    actor.id,
    `layout:publish:${eventId}`,
    key,
    input,
    async (tx) => {
      const draft = await tx.layoutTemplate.findUnique({ where: { eventId } });
      invariant(
        draft && draft.revision === input.version,
        "VERSION_CONFLICT",
        "ร่างผังเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      const event = await tx.event.findUnique({ where: { id: eventId } });
      invariant(
        event && !["CANCELLED", "COMPLETED"].includes(event.status),
        "INVALID_TRANSITION",
        "งานนี้ไม่สามารถเผยแพร่ผังได้",
      );
      const parsed = layoutInput.parse({ ...draft, version: draft.revision });
      const warnings = await validateGeometry(tx, eventId, parsed, true);
      const latest = await tx.layoutVersion.findFirst({
        where: { eventId },
        orderBy: { version: "desc" },
      });
      const published = await tx.layoutVersion.create({
        data: {
          eventId,
          templateId: draft.id,
          version: (latest?.version ?? 0) + 1,
          width: draft.width,
          height: draft.height,
          geometry: draft.geometry as Prisma.InputJsonValue,
          publishedById: actor.id,
        },
      });
      const changed = await tx.event.updateMany({
        where: { id: eventId, version: event.version },
        data: {
          publishedLayoutVersionId: published.id,
          version: { increment: 1 },
        },
      });
      invariant(
        changed.count === 1,
        "VERSION_CONFLICT",
        "งานเปลี่ยนแปลง กรุณาโหลดใหม่",
      );
      // Lock the draft revision too: a concurrent save cannot be silently published.
      const locked = await tx.layoutTemplate.updateMany({
        where: { id: draft.id, revision: input.version },
        data: { revision: { increment: 1 } },
      });
      invariant(locked.count === 1, "VERSION_CONFLICT", "ร่างผังเปลี่ยนแปลง");
      await audit(
        tx,
        actor.id,
        "LAYOUT_PUBLISH",
        "LayoutVersion",
        published.id,
      );
      return { ...published, draftVersion: input.version + 1, warnings };
    },
  );
}
