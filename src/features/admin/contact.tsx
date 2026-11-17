"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useResource } from "@/lib/client-api";
import { socialChannels } from "@/shared/contact";
import { ErrorNotice, Field, Loading, PageHeading } from "@/components/ui";

export function ContactSettings() {
  const resource = useResource<{ contact: Record<string, unknown> }>(
    "/api/admin/contact",
  );
  const mutation = useMutation();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const fields = [
    { key: "phone", label: "โทรศัพท์", type: "tel" },
    { key: "line", label: "LINE ID", type: "text" },
    { key: "email", label: "อีเมลติดต่อ", type: "email" },
    { key: "address", label: "ที่อยู่", type: "text" },
    ...socialChannels.map((c) => ({ ...c, type: "url" })),
  ];
  return (
    <>
      <PageHeading
        title="โซเชียลมีเดียและช่องทางติดต่อ"
        description="ข้อมูลจะแสดงที่ท้ายเว็บไซต์และหน้าข้อกำหนด เว้นว่างเพื่อซ่อนช่องทาง"
      />
      <ErrorNotice
        error={resource.error || mutation.error}
        retry={resource.reload}
      />
      {resource.loading ? (
        <Loading />
      ) : resource.data ? (
        <form
          className="panel stack"
          onChange={() => setSaved(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (mutation.pending) return;
            const form = new FormData(e.currentTarget);
            const payload = Object.fromEntries(
              fields.map((f) => [f.key, String(form.get(f.key) || "").trim()]),
            );
            try {
              await mutation.run("/api/admin/contact", payload, "PATCH");
              setSaved(true);
              await resource.reload();
              router.refresh();
            } catch {}
          }}
        >
          <div className="form-grid">
            {fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                hint={
                  field.type === "url"
                    ? "ลิงก์เต็มขึ้นต้นด้วย https://"
                    : undefined
                }
              >
                <input
                  name={field.key}
                  type={field.type}
                  maxLength={500}
                  defaultValue={String(resource.data?.contact[field.key] || "")}
                />
              </Field>
            ))}
          </div>
          {saved ? (
            <p role="status" className="notice success-notice">
              บันทึกช่องทางติดต่อแล้ว
            </p>
          ) : null}
          <button className="button" disabled={mutation.pending}>
            {mutation.pending ? "กำลังบันทึก" : "บันทึกช่องทางติดต่อ"}
          </button>
        </form>
      ) : null}
    </>
  );
}
