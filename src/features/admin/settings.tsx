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
        const existingContact = stringRecord(value.contact);
        delete existingContact.phone;
        delete existingContact.line;
        delete existingContact.email;
        const payload = {
          displayName: field("displayName"),
          logo: field("logo") || null,
          contact: {
            ...existingContact,
            address: field("address"),
          },
          paymentInstructions: {},
          bookingPolicy: {
            holdMinutes: 5,
            reviewHours: 24,
            correctionHours: 24,
            terms: "ชำระเงินผ่าน QR Code อัตโนมัติภายใน 5 นาที หลังสร้างรายการจอง",
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
      <ErrorNotice error={mutation.error} />
      {saved ? (
        <p role="status" className="notice">
          บันทึกข้อมูลร้านแล้ว
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
        title="ตั้งค่าร้าน"
        description="จัดการชื่อร้าน โลโก้ สีหลัก และที่อยู่ของร้าน"
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
