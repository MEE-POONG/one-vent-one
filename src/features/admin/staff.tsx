"use client";
import { useState } from "react";
import { useMutation, useResource } from "@/lib/client-api";
import type { EventData, PageData } from "@/lib/client-types";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
  Pagination,
} from "@/components/ui";

type Staff = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  assignedEventIds: string[];
};
const roles = [
  ["CUSTOMER", "ลูกค้า"],
  ["SUPER_ADMIN", "ผู้ดูแลสูงสุด"],
  ["EVENT_MANAGER", "ผู้จัดการอีเวนท์"],
  ["PAYMENT_REVIEWER", "ผู้ตรวจชำระเงิน"],
  ["CHECKIN_STAFF", "เจ้าหน้าที่ตรวจบัตร"],
] as const;

function StaffEditor({
  user,
  onSaved,
  close,
}: {
  user: Staff;
  onSaved: () => Promise<void>;
  close: () => void;
}) {
  const [selectedRoles, setSelectedRoles] = useState(user.roles);
  const [assignments, setAssignments] = useState(user.assignedEventIds);
  const [eventPage, setEventPage] = useState(1);
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const events = useResource<PageData<EventData>>(
    `/api/admin/events?page=${eventPage}&pageSize=20`,
  );
  const mutation = useMutation();
  function toggle(values: string[], value: string, checked: boolean) {
    return checked
      ? [...new Set([...values, value])]
      : values.filter((item) => item !== value);
  }
  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        try {
          await mutation.run("/api/admin/staff", {
            userId: user.id,
            roles: selectedRoles,
            assignedEventIds: assignments,
            reason,
          });
          setSaved(true);
          await onSaved();
        } catch {}
      }}
    >
      <div className="page-heading">
        <div>
          <h2>สิทธิ์ของ {user.name}</h2>
          <p className="muted">{user.email}</p>
        </div>
        <button type="button" className="button button-outline" onClick={close}>
          ปิด
        </button>
      </div>
      <fieldset className="stack-sm">
        <legend>บทบาทของผู้ใช้</legend>
        {roles.map(([value, label]) => (
          <label className="check-label" key={value}>
            <input
              type="checkbox"
              checked={selectedRoles.includes(value)}
              onChange={(e) => {
                setSelectedRoles(
                  toggle(selectedRoles, value, e.target.checked),
                );
                setSaved(false);
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="stack-sm">
        <legend>อีเวนท์ที่อนุญาตให้ตรวจบัตร</legend>
        <p className="muted">
          เลือกอีเวนท์และบทบาทเจ้าหน้าที่ตรวจบัตรควบคู่กัน เลือกไว้{" "}
          {assignments.length} งาน
        </p>
        <ErrorNotice error={events.error} retry={events.reload} />
        {events.loading ? (
          <Loading />
        ) : events.data?.items.length ? (
          <>
            {events.data.items.map((event) => (
              <label className="check-label" key={event.id}>
                <input
                  type="checkbox"
                  checked={assignments.includes(event.id)}
                  onChange={(e) => {
                    setAssignments(
                      toggle(assignments, event.id, e.target.checked),
                    );
                    setSaved(false);
                  }}
                />
                {event.title}
              </label>
            ))}
            <Pagination {...events.data} onChange={setEventPage} />
          </>
        ) : !events.error ? (
          <Empty title="ยังไม่มีอีเวนท์" />
        ) : null}
      </fieldset>
      <Field label="เหตุผลที่เปลี่ยนสิทธิ์">
        <textarea
          required
          minLength={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setSaved(false);
          }}
          placeholder="ระบุหน้าที่หรือเหตุผลเพื่อบันทึกประวัติ"
        />
      </Field>
      <ErrorNotice error={mutation.error} />
      {saved ? (
        <p role="status" className="notice">
          บันทึกสิทธิ์แล้ว การเปลี่ยนแปลงมีผลกับคำขอถัดไปของบัญชีนี้
        </p>
      ) : null}
      <button
        className="button"
        disabled={
          mutation.pending || !selectedRoles.length || reason.trim().length < 3
        }
      >
        {mutation.pending ? "กำลังบันทึก" : "บันทึกสิทธิ์"}
      </button>
    </form>
  );
}

export function StaffPermissions() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Staff | null>(null);
  const resource = useResource<PageData<Staff>>(
    `/api/admin/staff?page=${page}&pageSize=15&q=${encodeURIComponent(query)}`,
  );
  return (
    <>
      <PageHeading
        title="ผู้ใช้และสิทธิ์เจ้าหน้าที่"
        description="สมาชิกสมัครเป็นลูกค้าเท่านั้น ผู้ดูแลกำหนดหน้าที่และอีเวนท์ที่ตรวจบัตรได้จากหน้านี้"
      />
      <div className="filter-bar">
        <Field label="ค้นหาชื่อหรืออีเมล">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="ชื่อหรืออีเมล"
          />
        </Field>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>บทบาท</th>
                  <th>งานที่ตรวจบัตรได้</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </td>
                    <td>
                      {user.roles
                        .map(
                          (role) =>
                            roles.find((item) => item[0] === role)?.[1] ?? role,
                        )
                        .join(", ")}
                    </td>
                    <td>{user.assignedEventIds.length} งาน</td>
                    <td>
                      <button
                        className="button button-outline button-small"
                        onClick={() => setSelected(user)}
                      >
                        แก้ไขสิทธิ์
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...resource.data} onChange={setPage} />
        </>
      ) : !resource.error ? (
        <Empty title="ไม่พบผู้ใช้ที่ค้นหา" />
      ) : null}
      {selected ? (
        <StaffEditor
          key={selected.id}
          user={selected}
          onSaved={resource.reload}
          close={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
