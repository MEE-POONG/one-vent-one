"use client";
import { useState } from "react";
import { useResource } from "@/lib/client-api";
import type { PageData } from "@/lib/client-types";
import {
  dateTime,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
  Pagination,
} from "@/components/ui";

type Audit = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  reason?: string | null;
  changes?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { name: string } | null;
};
const actionNames: Record<string, string> = {
  BOOKING_CREATED: "สร้างรายการจอง",
  BOOKING_EXPIRED: "หมดเวลาชำระ",
  BOOKING_CANCELLED: "ยกเลิกรายการจอง",
  BOOKING_REJECTED: "ปฏิเสธรายการจอง",
  PAYMENT_SUBMITTED: "ส่งหลักฐานชำระเงิน",
  PAYMENT_VERIFIED: "ตรวจรับเงินจริง",
  PAYMENT_CORRECTION_REQUESTED: "ขอแก้ไขหลักฐาน",
  LATE_PAYMENT_RECORDED: "บันทึกเงินรับย้อนหลัง",
  EXTERNAL_REFUND_RECORDED: "บันทึกการคืนเงินจริง",
  REFUND_REQUESTED: "สร้างรายการคืนเงิน",
  TICKET_CHECKED_IN: "ตรวจบัตรเข้างาน",
  EVENT_CREATE: "สร้างอีเวนท์",
  EVENT_UPDATE: "แก้ไขอีเวนท์",
  EVENT_PUBLISHED: "เปิดขายอีเวนท์",
  EVENT_CLOSED: "ปิดขายอีเวนท์",
  EVENT_CANCELLED: "ยกเลิกอีเวนท์",
  EVENT_COMPLETED: "สิ้นสุดอีเวนท์",
  LAYOUT_SAVE: "บันทึกร่างผัง",
  LAYOUT_PUBLISH: "เผยแพร่ผัง",
  BUSINESS_UPDATE: "แก้ไขข้อมูลธุรกิจ",
  STAFF_PERMISSIONS_UPDATE: "เปลี่ยนสิทธิ์เจ้าหน้าที่",
  BOOTSTRAP_ADMIN: "สร้างผู้ดูแลเริ่มต้น",
  PRICE_UPDATE: "เปลี่ยนราคา",
  ZONE_CREATE: "สร้างโซน",
  UNIT_CREATE: "สร้างหน่วยขาย",
  TICKET_TYPE_CREATE: "สร้างประเภทบัตร",
  CAPACITY_UPDATE: "เปลี่ยนความจุ",
  INVENTORY_UPDATE: "เปลี่ยนสถานะหน่วยขาย",
  EVENT_DRAFT: "กลับเป็นฉบับร่าง",
  EVENT_DELETE: "ลบอีเวนท์",
  EVENT_DUPLICATE: "ทำซ้ำอีเวนท์",
  ZONE_UPDATE: "แก้ไขโซน",
  ZONE_DELETE: "ลบโซน",
  UNIT_DELETE: "ลบหน่วยขาย",
  UNIT_ACTIVE_UPDATE: "เปลี่ยนการขายหน่วย",
  TICKET_TYPE_UPDATE: "แก้ไขประเภทบัตร",
  TICKET_TYPE_DELETE: "ลบประเภทบัตร",
  CLI_PROMOTE_ADMIN: "เลื่อนเป็นผู้ดูแลผ่านคำสั่งเซิร์ฟเวอร์",
  CLI_RESET_PASSWORD: "รีเซ็ตรหัสผ่านผ่านคำสั่งเซิร์ฟเวอร์",
  ROLE_MIGRATION: "ย้ายสิทธิ์เป็นระบบ 3 ระดับ",
};

export function AuditHistory() {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [entityId, setEntityId] = useState("");
  const resource = useResource<PageData<Audit>>(
    `/api/admin/audit?page=${page}&pageSize=20${entityId ? `&entityId=${encodeURIComponent(entityId)}` : ""}`,
  );
  return (
    <>
      <PageHeading
        title="ประวัติการดำเนินการ"
        description="ตรวจสอบผู้ดำเนินการ เวลา และเหตุผลของรายการสำคัญในระบบ"
      />
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setEntityId(input.trim());
          setPage(1);
        }}
      >
        <Field label="รหัสรายการที่ต้องการตรวจสอบ">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={100}
            placeholder="เว้นว่างเพื่อดูทุกรายการ"
          />
        </Field>
        <button className="button button-outline">ค้นหา</button>
        {entityId ? (
          <button
            className="button button-subtle"
            type="button"
            onClick={() => {
              setInput("");
              setEntityId("");
              setPage(1);
            }}
          >
            ล้างตัวกรอง
          </button>
        ) : null}
      </form>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>การดำเนินการ</th>
                  <th>ผู้ดำเนินการ</th>
                  <th>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{dateTime(entry.createdAt)}</td>
                    <td>
                      <strong>
                        {actionNames[entry.action] ?? entry.action}
                      </strong>
                      <small>{entry.entity}</small>
                    </td>
                    <td>{entry.actor?.name ?? "ระบบอัตโนมัติ"}</td>
                    <td>
                      <p>{entry.reason ?? "—"}</p>
                      <details>
                        <summary>ข้อมูลรายการ</summary>
                        <p style={{ overflowWrap: "anywhere" }}>
                          รหัส: {entry.entityId}
                        </p>
                        {entry.changes ? (
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                              maxWidth: 420,
                            }}
                          >
                            {JSON.stringify(entry.changes, null, 2)}
                          </pre>
                        ) : null}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...resource.data} onChange={setPage} />
        </>
      ) : !resource.error ? (
        <Empty title="ยังไม่มีประวัติที่ตรงกับการค้นหา" />
      ) : null}
    </>
  );
}
