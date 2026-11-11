# OneVentOne — ข้อกำหนดร่วม

ตรวจและเริ่ม implementation: 10 พฤศจิกายน 2569 (Asia/Bangkok)

ผลิตภัณฑ์คือ **OneVentOne**; ร้าน **มงคลบาร์** เป็นข้อมูลกรณีศึกษาและ seed ของโครงการบริษัท มีพร้อม หนึ่ง deployment ให้บริการหนึ่งธุรกิจ (`BusinessProfile.key = primary`) และหลายรอบแสดง หนึ่ง Event คือหนึ่งรอบแสดง และหนึ่ง Booking รวมหลายรายการจาก Event เดียวเท่านั้น

## Stack และขอบเขต

| ส่วน                                      | รุ่นที่ล็อก             |
| ----------------------------------------- | ----------------------- |
| Node.js ที่ใช้ตรวจ                        | 24.21.0                 |
| Next.js App Router                        | 16.4.6                  |
| React / React DOM                         | 19.3.1                  |
| TypeScript                                | 6.0.3                   |
| Prisma / @prisma/client                   | 6.19.3 / 6.19.3         |
| Better Auth / @better-auth/prisma-adapter | 1.7.19 / 1.7.19         |
| Tailwind CSS                              | 4.3.5                   |
| Zod                                       | 4.6.7                   |
| react-konva / konva                       | 19.3.2 / 10.9.1         |
| MongoDB development replica set           | 8.0.17, wiredTiger, rs0 |

`package-lock.json` เป็นรายการ dependency ฉบับแน่นอน ใช้ Next.js แอปเดียว, Node runtime, Route Handlers และ domain services ภายใต้ `src/server` ไม่แยก Express/NestJS และไม่เปลี่ยนฐานข้อมูลเป็น SQL MongoDB ต้องเป็น replica set เพื่อรองรับ transactions ใช้ `prisma db push` ไม่ใช้ Prisma Migrate

รุ่นแรกไม่รวม multi-tenant SaaS, payment gateway, resale, การแบ่งรายได้, ผัง 3D, CAD หรือการแก้ผังพร้อมกันแบบ collaboration ไม่มีการ deploy หรือเขียน production โดยอัตโนมัติ

## Authentication

ใช้ Better Auth email/password กับ Prisma adapter `provider: mongodb` โดยปิดการสร้าง ID ของ library (`advanced.database.generateId: false`) ให้ Prisma/MongoDB สร้าง ObjectId ใช้ User/Session/Account/Verification/RateLimit ตาม library รหัสผ่านเก็บใน `Account.password` ด้วยกลไก hash ของ Better Auth ไม่เก็บ plaintext และไม่มี custom password/session implementation

- สมัครสาธารณะได้ `CUSTOMER` เท่านั้น: User.roles มี DB default และ additional field กำหนด `input: false`
- session ใช้ cookie ของ Better Auth อายุ 7 วัน; ปิด cookie cache; server โหลด role ปัจจุบันจาก DB ทุกคำขอ
- auth endpoint `/api/auth/[...all]`; `POST /api/auth/sign-up/email`, `sign-in/email`, `sign-out`; `GET /api/auth/get-session`
- รหัสผ่านขั้นต่ำ 12 ตัวอักษร สูงสุด 128 ตัวอักษร
- ไม่ติดตั้ง mail service หรือ reset mail handler จึงยังไม่มี flow กู้รหัสผ่านที่ส่งอีเมลจริง
- Better Auth ตรวจ origin/CSRF; API mutation เพิ่ม origin check; auth rate limiter เก็บใน MongoDB; operation rate limiter ใช้ ApiRateLimit ใน MongoDB
- ไม่เชื่อ client IP headers โดยปริยาย หากอยู่หลัง proxy ต้องตั้ง `TRUSTED_CLIENT_IP_HEADER` ให้ตรง header ที่ proxy เขียนทับ และปิด direct ingress
- สร้างผู้ดูแลเริ่มต้นด้วย `npm run admin:create` (ถามแบบโต้ตอบ หรือใช้ environment ชั่วคราว) คำสั่งนี้ปฏิเสธการเลื่อนสิทธิ์บัญชีสาธารณะที่มีอยู่แล้ว การเลื่อนสิทธิ์ทำได้เฉพาะคำสั่งแยก `npm run admin:promote -- <email>` ที่ผู้ดูแลเซิร์ฟเวอร์ยืนยันเอง และกู้รหัสผ่านด้วย `npm run admin:reset-password -- <email>` (ล้าง session ทั้งหมด) ทุกคำสั่งบันทึก AuditLog

## สิทธิ์

ระบบนี้ติดตั้งให้ร้านเดียว (ไม่ใช่ระบบกลางหลายร้าน) จึงมี 3 ระดับสิทธิ์

| Role        | ผู้ใช้          | สิทธิ์                                                                                                             |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| SUPER_ADMIN | เจ้าของร้าน     | ทุกอย่างของ ADMIN และจัดการพนักงาน/สิทธิ์ ตั้งค่าธุรกิจและบัญชีรับเงิน ดูประวัติการทำรายการ (AuditLog)             |
| ADMIN       | พนักงานดูแลเว็บ | อีเวนท์ โซน หน่วยขาย ราคา ผัง รายการจอง ตรวจหลักฐานและเงินจริง ขอแก้ไข ปฏิเสธ ยกเลิก คืนเงิน ตรวจบัตรทุกงาน รายงาน |
| CUSTOMER    | ลูกค้า          | จอง อ่านและยกเลิกรายการที่ยังไม่ส่งเงินของตน ส่งหลักฐาน และอ่านบัตร/หลักฐานของตน                                   |

แต่ละบัญชีมีระดับเดียว เก็บเป็น roles `[CUSTOMER]`, `[CUSTOMER, ADMIN]` หรือ `[CUSTOMER, SUPER_ADMIN]` (CUSTOMER คงไว้ให้พนักงานจองได้) SUPER_ADMIN ผ่านทุกการตรวจของ ADMIN เจ้าของร้านลดสิทธิ์ตัวเองไม่ได้ ข้อมูลจากรุ่น 5 role ย้ายด้วย `npm run db:migrate-roles` (EVENT_MANAGER/PAYMENT_REVIEWER/CHECKIN_STAFF → ADMIN) การซ่อนเมนูเป็น UX เท่านั้น ทุก operation ตรวจ session/role/ownership ฝั่ง server ไม่มี client supplied userId/reviewerId ที่ถือเป็น authority

## Enums และสถานะ

| กลุ่ม                | ค่า                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------- |
| SellingMode          | TABLE, SEAT, GENERAL_ADMISSION                                                            |
| EventStatus          | DRAFT, PUBLISHED, CLOSED, CANCELLED, COMPLETED                                            |
| BookingStatus        | PENDING_PAYMENT, PENDING_REVIEW, ACTION_REQUIRED, CONFIRMED, EXPIRED, REJECTED, CANCELLED |
| UnitInventoryStatus  | AVAILABLE, HELD, REVIEW_RESERVED, SOLD, BLOCKED                                           |
| AllocationStatus     | HELD, REVIEW_RESERVED, SOLD, RELEASED                                                     |
| PaymentAttemptStatus | SUBMITTED, VERIFIED, REJECTED                                                             |
| RefundStatus         | PENDING, REFUNDED, CANCELLED                                                              |
| TicketStatus         | ACTIVE, USED, REVOKED                                                                     |

`UNPAID` เป็นข้อความสรุปเมื่อไม่มีการตรวจรับเงิน ไม่ใช่ PaymentAttemptStatus

| เหตุการณ์                | Booking ก่อน → หลัง                 | Stock                                            |
| ------------------------ | ----------------------------------- | ------------------------------------------------ |
| สร้างรายการสำเร็จ        | ใหม่ → PENDING_PAYMENT              | HELD ตาม owner                                   |
| hold ครบกำหนดโดย server  | PENDING_PAYMENT → EXPIRED           | คืนเฉพาะของ owner เดิมครั้งเดียว                 |
| ส่งหลักฐานครบก่อนหมดเวลา | PENDING_PAYMENT → PENDING_REVIEW    | REVIEW_RESERVED                                  |
| ขอแก้ไข                  | PENDING_REVIEW → ACTION_REQUIRED    | คง REVIEW_RESERVED                               |
| ส่งใหม่                  | ACTION_REQUIRED → PENDING_REVIEW    | คง REVIEW_RESERVED ไม่ใช้ deadline เดิม          |
| ตรวจเงินจริงอนุมัติ      | PENDING_REVIEW → CONFIRMED          | SOLD และออก Ticket ใน transaction เดียว          |
| ปฏิเสธ/เจ้าหน้าที่ยกเลิก | สถานะที่อนุญาต → REJECTED/CANCELLED | คืนครั้งเดียว เพิกถอนบัตร และติดตามเงินคืนแยกกัน |

PENDING_REVIEW/ACTION_REQUIRED ไม่หมดอายุด้วย hold timer เดิม `reviewDueAt` และ `correctionDueAt` เป็นคิวแจ้งเตือน ไม่ปล่อย stock อัตโนมัติ หลักฐานหลัง EXPIRED ไม่คืนชีพรายการหรือแย่ง stock ต้องให้เจ้าหน้าที่จัดการข้อเท็จจริงและเงินคืน

## กฎความถูกต้อง

- เงินเป็น integer หน่วยสตางค์ (`*Satang`), THB; server อ่านราคาจาก DB ไม่รับยอด client เป็นความจริง เวลาเก็บ UTC ส่ง ISO 8601 แสดง Asia/Bangkok และใช้ server time ตัดสิน deadline
- TABLE quantity=1; admissionCount ตามโต๊ะ เช่น 4; SEAT quantity=1/admissionCount=1; GA quantity=admissionCount แต่ละ BookingItem มี allocation ของตัวเอง
- ห้ามเปิดขายทั้งโต๊ะและที่นั่งย่อยของโต๊ะเดียวกันใน Event เดียว GA หลายราคาของโซนเดียวกันใช้ pool ร่วมใน seed ห้ามทำ capacity ซ้ำตามแต่ละราคา
- CapacityPool ทุก counter ไม่ติดลบ และ available+held+reviewReserved+sold+blocked=capacity
- สร้าง Booking/Items และกัน stock ทุกชิ้นใน transaction สั้น ต้องสำเร็จทั้งหมดหรือ rollback ทั้งหมด ใช้ conditional update/state/version/owner พร้อม bounded retry ไม่มี memory lock
- Durable IdempotencyRecord unique(actorId,operation,key) เก็บ canonical request hash และผลตอบกลับภายใน transaction เดียวกับผลข้างเคียง key เดิม/payload เดิม replay; payload ต่าง 409 ถ้าการตอบกลับขาดหาย ให้ retry key เดิม
- UnitInventory unique(eventId,unitId) เป็น record ถาวร ประวัติ BookingItem.unitId ไม่ unique จึงจองใหม่หลังยกเลิกได้
- Booking.snapshot และ BookingItem.snapshot เก็บชื่อ ราคา จำนวนสิทธิ์ เงื่อนไข และ published layout version ขณะจอง การเปลี่ยนราคาหรือผังใหม่ไม่เปลี่ยนรายการเก่า
- LayoutTemplate เป็น draft แก้ด้วย revision check; LayoutVersion เป็น published immutable snapshot geometry มี stable IDs และตำแหน่ง ไม่ใช่แหล่งราคาหรือ availability
- สลิปเก็บ private ใน storage adapter นอก public root; ตรวจ content/MIME/size และเจ้าของก่อน finalize; PaymentAttempt ใหม่ทุกครั้ง ไม่เขียนทับหลักฐานเก่า
- ยอดรับจริงใช้ PaymentAttempt ที่ VERIFIED/Booking.verifiedPaymentId และ verifiedAmountSatang ไม่บวกรวมสลิปที่ส่งซ้ำ ไม่ยืนยันเงินเข้าด้วยการ upload
- Ticket หนึ่งใบต่อ admission unique(bookingItemId,admissionSequence) ใช้ random opaque 32-byte credential ไม่มี PII เก็บ SHA-256 สำหรับ lookup และ AES-256-GCM encrypted credential เพื่อแสดง QR ซ้ำให้เจ้าของ `TICKET_ENCRYPTION_KEY` แยกจาก auth secret ไม่ log credential
- Check-in ตรวจสิทธิ์ ADMIN/Event/Booking CONFIRMED/Ticket ACTIVE แล้ว atomic first-use มี CheckInLog; QR เก่าที่ REVOKED ใช้ไม่ได้
- ยกเลิกไม่เท่ากับคืนเงิน RefundRecord unique(bookingId) ติดตามคืนเต็มจำนวนหนึ่งครั้งตามเงินจริงที่ตรวจแล้ว REFUNDED ต้องมีหลักฐานการคืนเงินภายนอก เว็บไม่โอนเงินเอง
- ไม่มี TTL บน booking/payment/refund/audit; cleanup ข้อมูลชั่วคราวต้องไม่เป็นกลไกปล่อย stock

## API / UI

API base `/api`, success `{ data, meta? }`, error `{ error: { code, message, fieldErrors?, requestId? } }` ยกเว้น `/api/auth/*` ซึ่งใช้ contract ของ Better Auth โดยตรง DTO และ validation ร่วมกันอยู่ `src/shared`; Prisma และ secrets ไม่เข้า browser

availability/booking response มี serverNow/expiry; client countdown ปรับจากเวลา server และ refetch เมื่อหมดเวลา; poll เฉพาะแท็บที่ active; timeout ไม่สร้าง intent/key ใหม่โดยอัตโนมัติ ไม่มี QR ก่อน backend อนุมัติ ไม่มี mock stock/payment success

แบรนด์แดง/ดำ/เทา: #0B0B0F, #18181B/#27272A, #E11D48, #F4F4F5 มี keyboard focus, status text, mobile booking, reduced motion; editor ใช้ react-konva เฉพาะ client

## ลำดับพัฒนาและแหล่งอ้างอิง

1. Database: schema/indexes/auth alignment → validate/generate → replica set db push → rerunnable seed
2. Backend: authorization/services → transactions/idempotency/storage → API contract
3. Frontend: public/account/admin/editor → typed API → network/error states
4. Integration: actual DB race tests, auth/ownership, build/lint/typecheck, browser viewport checks → ACCEPTANCE_REPORT

เอกสารทางการที่ตรวจ:

- [Prisma MongoDB และ baseline v6.19](https://www.prisma.io/docs/v7/prisma-orm/add-to-existing-project/mongodb)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth database/custom fields](https://better-auth.com/docs/concepts/database)
- [Better Auth rate limit/database storage](https://better-auth.com/docs/concepts/rate-limit)

ผลทดสอบจริงและส่วนที่ยังไม่ได้ตรวจต้องอ่าน `docs/ACCEPTANCE_REPORT.md` ไม่ถือว่าการมีโค้ดหรือ contract หมายถึงผ่าน acceptance แล้ว
