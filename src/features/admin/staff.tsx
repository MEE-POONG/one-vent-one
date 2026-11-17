"use client";
import { useState } from "react";
import { useMutation, useResource } from "@/lib/client-api";
import type { PageData } from "@/lib/client-types";
import { authClient } from "@/lib/auth-client";
import { type AccessLevel, accessLevelLabels } from "@/lib/roles";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
  Pagination,
} from "@/components/ui";

type StaffUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  role: AccessLevel;
};
const levels: { value: AccessLevel; description: string }[] = [
  {
    value: "CUSTOMER",
    description: "จองตั๋วและดูการจองของตัวเองเท่านั้น เข้าหลังบ้านไม่ได้",
  },
  {
    value: "ADMIN",
    description:
      "ดูแลงานประจำวัน: อีเวนท์และผัง รายการจอง ตรวจชำระเงิน คืนเงิน ตรวจบัตรเข้างาน และรายงาน",
  },
  {
    value: "SUPER_ADMIN",
    description:
      "ทุกอย่างของแอดมิน และจัดการพนักงาน ตั้งค่าร้าน/บัญชีรับเงิน ดูประวัติการทำรายการ",
  },
];

function StaffEditor({
  user,
  isSelf,
  onSaved,
  close,
}: {
  user: StaffUser;
  isSelf: boolean;
  onSaved: (updated: StaffUser) => Promise<void>;
  close: () => void;
}) {
  const [role, setRole] = useState<AccessLevel>(user.role);
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const mutation = useMutation();
  return (
    <form
      className="panel stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        try {
          const updated = await mutation.run<StaffUser>("/api/admin/staff", {
            userId: user.id,
            role,
            reason,
          });
          setSaved(true);
          setReason("");
          await onSaved(updated);
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
      <fieldset className="stack-sm" disabled={isSelf}>
        <legend>ระดับสิทธิ์</legend>
        {isSelf ? (
          <p className="muted">
            ลดสิทธิ์ผู้ดูแลสูงสุดของตัวเองไม่ได้
            เพื่อไม่ให้ร้านไม่มีเจ้าของบัญชี
          </p>
        ) : null}
        {levels.map((level) => (
          <label className="check-label" key={level.value}>
            <input
              type="radio"
              name="role"
              value={level.value}
              checked={role === level.value}
              onChange={() => {
                setRole(level.value);
                setSaved(false);
              }}
            />
            <span>
              <strong>{accessLevelLabels[level.value]}</strong>
              <small className="muted" style={{ display: "block" }}>
                {level.description}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="เหตุผลที่เปลี่ยนสิทธิ์">
        <textarea
          required
          minLength={3}
          maxLength={1000}
          value={reason}
          disabled={isSelf}
          onChange={(e) => {
            setReason(e.target.value);
            setSaved(false);
          }}
          placeholder="เช่น พนักงานใหม่ดูแลหน้าเว็บ / พนักงานลาออก"
        />
      </Field>
      <ErrorNotice error={mutation.error} />
      {saved ? (
        <p role="status" className="notice">
          บันทึกสิทธิ์แล้ว มีผลทันทีกับคำขอถัดไปของบัญชีนี้
        </p>
      ) : null}
      <button
        className="button"
        disabled={
          isSelf ||
          mutation.pending ||
          role === user.role ||
          reason.trim().length < 3
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
  const [staffOnly, setStaffOnly] = useState(false);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const { data: session } = authClient.useSession();
  const resource = useResource<PageData<StaffUser>>(
    `/api/admin/staff?page=${page}&pageSize=15&q=${encodeURIComponent(query)}${staffOnly ? "&staffOnly=1" : ""}`,
  );
  return (
    <>
      <PageHeading
        title="พนักงานและสิทธิ์"
        description="ทุกคนสมัครที่หน้าเว็บเป็นลูกค้าก่อน แล้วเจ้าของร้านเลือกระดับสิทธิ์ให้พนักงานจากหน้านี้"
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
        <label className="check-label">
          <input
            type="checkbox"
            checked={staffOnly}
            onChange={(e) => {
              setStaffOnly(e.target.checked);
              setPage(1);
            }}
          />
          แสดงเฉพาะพนักงานและเจ้าของร้าน
        </label>
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
                  <th>ระดับสิทธิ์</th>
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
                    <td>{accessLevelLabels[user.role]}</td>
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
          isSelf={selected.id === session?.user.id}
          onSaved={async (updated) => {
            setSelected(updated);
            await resource.reload();
          }}
          close={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
