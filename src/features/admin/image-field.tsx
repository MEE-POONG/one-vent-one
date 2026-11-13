"use client";

import Image from "next/image";
import { useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { ErrorNotice, Field } from "@/components/ui";
import { api } from "@/lib/client-api";
import { imageGuidelines } from "@/shared/images";

export function ImageField({
  name,
  label,
  kind,
  initialValue = "",
  disabled = false,
  onPendingChange,
  onChange,
}: {
  name: string;
  label: string;
  kind: "poster" | "logo";
  initialValue?: string;
  disabled?: boolean;
  onPendingChange: (pending: boolean) => void;
  onChange?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [broken, setBroken] = useState(false);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const guideline = imageGuidelines[kind];
  const change = (url: string) => {
    setValue(url);
    setBroken(false);
    if (url !== value) setDimensions(null);
    onChange?.();
  };
  const previewable = /^\/(?!\/)/.test(value) || /^https:\/\//.test(value);
  const tooSmall =
    dimensions &&
    (dimensions.width < guideline.minimumWidth ||
      dimensions.height < guideline.minimumHeight);
  const differentRatio =
    dimensions &&
    Math.abs(
      dimensions.width / dimensions.height - guideline.width / guideline.height,
    ) /
      (guideline.width / guideline.height) >
      0.01;

  return (
    <div className="admin-image-field stack-sm" aria-busy={pending}>
      <Field
        label={label}
        hint="PNG, JPEG หรือ WebP ไม่เกิน 5 MB รูปจะเปลี่ยนเมื่อกดบันทึกข้อมูล"
      >
        <span className="admin-image-recommendation">
          {guideline.recommendation}
        </span>
        <small>{guideline.placement}</small>
        <input type="hidden" name={name} value={value} />
        <div
          className={`admin-image-preview ${kind === "logo" ? "is-logo" : ""}`}
        >
          {value && previewable && !broken ? (
            <Image
              key={value}
              src={value}
              alt={`ตัวอย่าง${label}`}
              width={guideline.width}
              height={guideline.height}
              unoptimized
              onLoad={(event) =>
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setBroken(true)}
            />
          ) : (
            <span className="muted">
              {value ? "ไม่สามารถแสดงตัวอย่างรูปภาพได้" : "ยังไม่มีรูปภาพ"}
            </span>
          )}
        </div>
        <small>
          {kind === "poster"
            ? "ตัวอย่างกรอบการ์ด 2:3 (ครอปกึ่งกลางเหมือนหน้าลูกค้า)"
            : "ตัวอย่างพื้นที่โลโก้ 3:1 (แสดงเต็มรูป ไม่ครอป)"}
        </small>
        <span className="admin-image-picker">
          {pending ? (
            <LoaderCircle size={18} className="spinner" />
          ) : (
            <ImagePlus size={18} />
          )}
          <span>
            {pending
              ? "กำลังอัปโหลดรูปภาพ…"
              : value
                ? "เลือกรูปใหม่จากเครื่อง"
                : "เลือกรูปจากเครื่อง"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={`เลือก${label}จากเครื่อง`}
            disabled={disabled || pending}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              setError(null);
              if (
                !file.size ||
                file.size > 5 * 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              ) {
                setError(
                  new Error(
                    "กรุณาเลือกรูป PNG, JPEG หรือ WebP ขนาดไม่เกิน 5 MB",
                  ),
                );
                return;
              }
              setPending(true);
              onPendingChange(true);
              try {
                const data = new FormData();
                data.set("kind", kind);
                data.set("file", file);
                const uploaded = await api<{ url: string }>(
                  "/api/admin/images",
                  { method: "POST", body: data },
                );
                change(uploaded.url);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause
                    : new Error("อัปโหลดรูปภาพไม่สำเร็จ"),
                );
              } finally {
                setPending(false);
                onPendingChange(false);
              }
            }}
          />
        </span>
      </Field>
      {dimensions ? (
        <div className="admin-image-size stack-sm" role="status">
          <p>
            ขนาดรูปที่เลือก: {dimensions.width.toLocaleString("en-US")} ×{" "}
            {dimensions.height.toLocaleString("en-US")} px
          </p>
          {tooSmall ? (
            <p className="admin-image-advice">
              รูปนี้เล็กกว่าขนาดขั้นต่ำที่แนะนำ อาจไม่คมชัดเมื่อแสดงบนหน้าจอใหญ่
            </p>
          ) : null}
          {differentRatio ? (
            <p className="admin-image-advice">
              {kind === "poster"
                ? "สัดส่วนรูปต่างจาก 2:3 บางส่วนจะถูกตัดออกตามพรีวิว หากต้องการให้ภาพแสดงครบ ควรเตรียมรูปสัดส่วน 2:3"
                : "สัดส่วนรูปต่างจาก 3:1 ระบบจะแสดงโลโก้ครบโดยเว้นพื้นที่ว่างตามพรีวิว"}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="admin-image-design-tip muted">{guideline.designTip}</p>
      {value ? (
        <button
          type="button"
          className="button button-outline button-small"
          disabled={disabled || pending}
          onClick={() => {
            change("");
            setError(null);
          }}
        >
          <Trash2 size={15} />
          นำรูปออก
        </button>
      ) : null}
      <details>
        <summary>ใช้ลิงก์รูปภาพแทน</summary>
        <Field
          label="URL รูปภาพ"
          hint="ใช้ HTTPS หรือไฟล์ในเว็บไซต์ เช่น /concert-hero.png"
        >
          <input
            value={value}
            maxLength={500}
            disabled={disabled || pending}
            onChange={(event) => change(event.target.value)}
          />
        </Field>
      </details>
      <ErrorNotice error={error} />
      {pending ? (
        <p role="status" className="muted">
          กำลังอัปโหลด กรุณารอให้เสร็จก่อนบันทึก
        </p>
      ) : null}
    </div>
  );
}
