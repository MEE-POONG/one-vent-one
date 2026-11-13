"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useMutation, useResource } from "@/lib/client-api";
import type { Business } from "@/lib/client-types";
import { ErrorNotice, Field, Loading, PageHeading } from "@/components/ui";
import { ImageField } from "./image-field";

type Settings = Business & {
  reviewHours: number;
  correctionHours: number;
  theme?: { primary?: string };
};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const stringRecord = (record: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

function SettingsForm({
  value,
  onSaved,
}: {
  value: Settings;
  onSaved: () => Promise<void>;
}) {
  const mutation = useMutation();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [imagePending, setImagePending] = useState(false);
  return (
    <form
      className="stack"
      onChange={() => setSaved(false)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (imagePending || mutation.pending) return;
        const form = new FormData(e.currentTarget);
        const field = (name: string) => String(form.get(name) ?? "").trim();
        const payload = {
          displayName: field("displayName"),
          logo: field("logo") || null,
          contact: {
            ...stringRecord(value.contact),
            phone: field("phone"),
            line: field("line"),
            email: field("email"),
            address: field("address"),
          },
          paymentInstructions: {
            ...stringRecord(value.paymentInstructions),
            bankName: field("bankName"),
            accountName: field("accountName"),
            accountNumber: field("accountNumber"),
            note: field("note"),
          },
          bookingPolicy: {
            holdMinutes: Number(form.get("holdMinutes")),
            reviewHours: Number(form.get("reviewHours")),
            correctionHours: Number(form.get("correctionHours")),
            terms: field("terms"),
          },
          theme: { primary: field("primary") },
        };
        try {
          await mutation.run("/api/admin/business-profile", payload, "PATCH");
          setSaved(true);
          await onSaved();
          router.refresh();
        } catch {}
      }}
    >
      <section className="panel stack">
        <h2>ข้อมูลร้าน</h2>
        <div className="form-grid">
          <Field label="ชื่อร้าน">
            <input
              name="displayName"
              required
              maxLength={120}
              defaultValue={value.displayName}
            />
          </Field>
          <ImageField
            name="logo"
            label="โลโก้ร้าน"
            kind="logo"
            initialValue={value.logo ?? ""}
            disabled={mutation.pending}
            onPendingChange={setImagePending}
            onChange={() => setSaved(false)}
          />
          <Field label="โทรศัพท์">
            <input
              name="phone"
              type="tel"
              maxLength={100}
              defaultValue={text(value.contact.phone)}
            />
          </Field>
          <Field label="LINE">
            <input
              name="line"
              maxLength={100}
              defaultValue={text(value.contact.line)}
            />
          </Field>
          <Field label="อีเมลติดต่อ">
            <input
              name="email"
              type="email"
              maxLength={200}
              defaultValue={text(value.contact.email)}
            />
          </Field>
          <Field label="สีหลักของร้าน">
            <input
              name="primary"
              type="color"
              defaultValue={value.theme?.primary ?? "#E11D48"}
            />
          </Field>
          <div className="full">
            <Field label="ที่อยู่">
              <textarea
                name="address"
                maxLength={500}
                defaultValue={text(value.contact.address)}
              />
            </Field>
          </div>
        </div>
      </section>
      <section className="panel stack">
        <h2>ช่องทางรับเงิน</h2>
        <p className="muted">
          ข้อมูลนี้แสดงให้ลูกค้าใช้โอนเงิน
          เจ้าหน้าที่ต้องตรวจเงินจริงก่อนอนุมัติ
          ระบบไม่มีการโอนหรือคืนเงินอัตโนมัติ
        </p>
        <div className="form-grid">
          <Field label="ธนาคาร">
            <input
              name="bankName"
              maxLength={200}
              defaultValue={text(value.paymentInstructions.bankName)}
            />
          </Field>
          <Field label="ชื่อบัญชี">
            <input
              name="accountName"
              maxLength={200}
              defaultValue={text(value.paymentInstructions.accountName)}
            />
          </Field>
          <Field label="เลขบัญชี">
            <input
              name="accountNumber"
              inputMode="numeric"
              maxLength={100}
              defaultValue={text(value.paymentInstructions.accountNumber)}
            />
          </Field>
          <Field label="หมายเหตุการโอน">
            <input
              name="note"
              maxLength={1000}
              defaultValue={text(value.paymentInstructions.note)}
            />
          </Field>
        </div>
      </section>
      <section className="panel stack">
        <h2>นโยบายการจอง</h2>
        <div className="form-grid">
          <Field
            label="เวลาชำระเงิน (นาที)"
            hint="ใช้กับรายการจองใหม่ 1–60 นาที"
          >
            <input
              name="holdMinutes"
              type="number"
              min={1}
              max={60}
              required
              defaultValue={
                value.holdMinutes === 15 ? 5 : value.holdMinutes
              }
            />
          </Field>
          <Field
            label="เวลาตรวจหลักฐาน (ชั่วโมง)"
            hint="ใช้จัดคิวเตือน ไม่ปล่อยสิทธิ์อัตโนมัติ"
          >
            <input
              name="reviewHours"
              type="number"
              min={1}
              max={168}
              required
              defaultValue={value.reviewHours}
            />
          </Field>
          <Field
            label="เวลาแก้ไขหลักฐาน (ชั่วโมง)"
            hint="ใช้จัดคิวติดตาม ไม่ใช่เวลาชำระเดิม"
          >
            <input
              name="correctionHours"
              type="number"
              min={1}
              max={168}
              required
              defaultValue={value.correctionHours}
            />
          </Field>
          <div className="full">
            <Field label="เงื่อนไขการจอง">
              <textarea
                name="terms"
                required
                maxLength={5000}
                rows={5}
                defaultValue={text(value.bookingPolicy.terms).replace(
                  /ภายใน\s*15\s*นาที/g,
                  "ภายใน 5 นาที",
                )}
              />
            </Field>
          </div>
        </div>
      </section>
      <ErrorNotice error={mutation.error} />
      {saved ? (
        <p role="status" className="notice">
          บันทึกข้อมูลธุรกิจแล้ว
        </p>
      ) : null}
      <div className="actions">
        <button className="button" disabled={mutation.pending || imagePending}>
          <Save size={18} />
          {mutation.pending ? "กำลังบันทึก" : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </form>
  );
}

export function BusinessSettings() {
  const resource = useResource<Settings>("/api/admin/business-profile");
  return (
    <>
      <PageHeading
        title="ตั้งค่าธุรกิจ"
        description="ข้อมูลร้าน ช่องทางรับเงิน และเงื่อนไขที่ใช้กับรายการจองใหม่"
      />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data ? (
        <SettingsForm value={resource.data} onSaved={resource.reload} />
      ) : null}
    </>
  );
}
