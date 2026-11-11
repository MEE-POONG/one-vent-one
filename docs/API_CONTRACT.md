# OneVentOne API contract

ฉบับ implementation 10 พฤศจิกายน 2569; backend Node.js runtime, `/api`; validation ต้นฉบับ `src/shared/booking.ts` และ `src/shared/catalog.ts`

## รูปแบบร่วม

- JSON success HTTP 200: `{ "data": ... }` รวมการสร้างรายการใน MVP
- JSON error: `{ "error": { "code", "message", "fieldErrors"?, "requestId"? } }`
- ทุก API ใช้ `Cache-Control: private, no-store` โดยเฉพาะข้อมูลบัญชี สลิป และ QR ไม่ผ่าน public image loader
- Auth `/api/auth/*` ใช้รูปแบบของ Better Auth โดยตรง ไม่ห่อ data/error แบบ domain API
- Cookie session, same-origin mutation; ส่ง `Origin` ตรง `BETTER_AUTH_URL` ปฏิเสธ cross-site; userId/roles ไม่ใช่ authority จาก body
- Mutation ของ domain ต้องส่ง `Idempotency-Key` 8–128 ตัว `[A-Za-z0-9:_-]` แนะนำ UUID; key เดิม payload เดิมคืนผลเดิม key เดิม payload ต่าง HTTP 409; หลัง timeout ใช้ key เดิม
- ObjectId เป็น hexadecimal 24 ตัว; เวลา UTC ISO 8601 (input รับ timezone offset); เงิน integer สตางค์ THB
- List ใช้ `page` เริ่ม 1 และ `pageSize` 1–100 ค่าเริ่ม 20; `q` จำกัดความยาว ไม่มี raw Mongo filters จาก client
- `version` คือเวอร์ชันที่อ่านล่าสุด mismatch 409 และให้ refetch ก่อนเลือกทำรายการใหม่
- endpoint private ต้องตรวจ server authorization แม้ UI ซ่อนปุ่มแล้ว

## Authentication / บัญชี

| Method และ path            | Input               | Result / สิทธิ์                                              |
| -------------------------- | ------------------- | ------------------------------------------------------------ |
| POST `/auth/sign-up/email` | name,email,password | Better Auth; roles ที่ส่งมาไม่เพิ่มสิทธิ์, CUSTOMER เท่านั้น |
| POST `/auth/sign-in/email` | email,password      | Better Auth session cookie                                   |
| GET `/auth/get-session`    | —                   | session หรือ null                                            |
| POST `/auth/sign-out`      | —                   | ยกเลิก session; client ล้างข้อมูลส่วนตัว                     |
| GET `/me`                  | —                   | id,name,email,roles; ต้องเข้าสู่ระบบ                         |

ยังไม่มี mail reset API ของผลิตภัณฑ์ ไม่มีการแสดงข้อความส่งอีเมลสำเร็จโดยไม่มีบริการจริง

## สาธารณะ

| Method และ path                | Input             | data                                                                   |
| ------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| GET `/business-profile`        | —                 | BusinessProfile singleton primary                                      |
| GET `/events`                  | q,page,pageSize   | `{items,total,page,pageSize}`; ไม่แสดง DRAFT                           |
| GET `/events?slug=...`         | slug ชัดเจน       | Event detail โดย slug                                                  |
| GET `/events/:id`              | ObjectId เท่านั้น | Event + zones.units/ticketTypes/pools + layout                         |
| GET `/events/:id/availability` | ObjectId          | `{eventId,eventStatus,serverNow,units,pools,ticketTypes,zones,layout}` |

Event summary มี `minPriceSatang` หรือ null; availability unit มี `status` และ `inventory:{status,version}` ไม่มี hold owner รั่วออกสาธารณะ ไม่ถือว่าการเลือกหน่วยใน browser เป็นการกันสิทธิ์

## การจองและหลักฐาน

| Method และ path               | Input                                                | data / เงื่อนไข                                                                                |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| POST `/bookings`              | `{eventId,items:[{unitId?,ticketTypeId?,quantity}]}` | Booking detail; ต้องมี identifier เพียงชนิดเดียวต่อ item; TABLE/SEAT quantity=1; เงินคิดจาก DB |
| GET `/me/bookings`            | page,pageSize                                        | `{bookings,total,page,pageSize,serverNow}` เฉพาะของตน                                          |
| GET `/bookings/:id`           | —                                                    | detail ของเจ้าของ หรือผู้จัดงาน/ผู้ตรวจเงิน; ตรวจ expiry ก่อนอ่าน                              |
| POST `/bookings/:id/cancel`   | `{version,reason}`                                   | ลูกค้ายกเลิกได้เฉพาะ PENDING_PAYMENT                                                           |
| POST `/bookings/:id/uploads`  | multipart `file` PNG/JPEG/WebP ≤5 MB                 | `{id,mime,bytes}` MediaAsset private; ไม่ใช่การรับชำระเงิน                                     |
| POST `/bookings/:id/payments` | `{assetId,declaredAmountSatang,transferTime}`        | Booking PENDING_REVIEW; finalize ก่อน hold หมดอายุ ยกเว้นการแก้หลักฐานจาก ACTION_REQUIRED      |
| GET `/bookings/:id/tickets`   | —                                                    | `{tickets,serverNow}`; owner เท่านั้น; ไม่มี tickets ก่อน CONFIRMED                            |
| GET `/private-assets/:id`     | —                                                    | image/png binary, session+ownership หรือ ADMIN/SUPER_ADMIN                                     |

Booking detail มี id,bookingNumber,eventId,userId,status,totalSatang,totalAdmissions,holdExpiresAt,reviewDueAt,correctionDueAt,version,reason,items,payments,refunds,snapshot,event,serverNow

Booking detail มี `auditTimeline:[{action,createdAt,reason}]` สูงสุด 50 รายการหลังตรวจสิทธิ์ ส่วน PaymentAttempt มี `duplicateEvidenceWarning` เพื่อเตือนเจ้าหน้าที่เมื่อใช้ภาพหลักฐานซ้ำ รวมถึงการส่ง MediaAsset เดิมอีกครั้ง คำเตือนนี้ไม่ใช่ผลตรวจธนาคาร

BookingItem มี sellingMode,unitId/ticketTypeId/poolId,quantity,admissionCount,unitPriceSatang,subtotalSatang,snapshot; admissionCount เป็นจำนวนสิทธิ์รวมของ item (โต๊ะ 1=4, ที่นั่ง 1=1, GA quantity=n=admissionCount n)

Ticket DTO มี id,status,admissionSequence,usedAt,itemLabel,token; token เป็น opaque credential แบบ random ไม่มีข้อมูลส่วนตัว แสดง QR จาก token นี้เท่านั้น ไม่มี token ใน audit หรือ error logs

Upload decode/re-encode เป็น PNG เก็บนอก public directory จำกัด pixels และขนาด ตรวจ booking owner และ content จริง การ retry upload อาจเหลือไฟล์ไม่มี record อ้างอิงแต่ไม่เพิ่ม PaymentAttempt ซ้ำ เก็บ file key จาก server เท่านั้น

## งาน โซน ราคา ผัง

ทุก path ในตารางเริ่ม `/admin/events`; อ่านและเขียนได้ ADMIN/SUPER_ADMIN

| Method และ suffix                             | Input                                                                     | data                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET `/`                                       | q,status?,page,pageSize                                                   | `{items,total,page,pageSize}` แต่ละ item มี `_count.bookings`                             |
| POST `/`                                      | EventFields                                                               | DRAFT Event + สร้างร่างผังว่าง                                                            |
| GET `/:id`                                    | —                                                                         | Event พร้อม zones,pools,units.inventory,ticketTypes,layoutTemplate,publishedLayoutVersion |
|                                               |                                                                           | + bookingCount,activeBookingCount,serverNow                                               |
| PATCH `/:id`                                  | EventFields + version                                                     | Event; เก็บ snapshot การจองเดิม                                                           |
| DELETE `/:id`                                 | `{version,reason}`                                                        | ลบถาวรเฉพาะ DRAFT/CLOSED/CANCELLED ที่ไม่มี Booking เลย พร้อมโครงสร้างและผังทั้งหมด       |
| POST `/:id/duplicate`                         | EventFields (ของงานใหม่)                                                  | DRAFT ใหม่ คัดลอก zones,pools,units,ticketTypes,ร่างผัง (id ใหม่) ไม่คัดลอกการจอง         |
| POST `/:id/publish`                           | `{version,reason}`                                                        | PUBLISHED; ต้องมีหน่วยขายและผังครอบคลุมทุกหน่วย                                           |
| POST `/:id/close`                             | `{version,reason}`                                                        | CLOSED                                                                                    |
| POST `/:id/draft`                             | `{version,reason}`                                                        | CLOSED → DRAFT เมื่อไม่มี booking ที่ใช้งานอยู่ เพื่อแก้โครงสร้าง                         |
| POST `/:id/complete`                          | `{version,reason}`                                                        | COMPLETED หลัง endsAt จาก PUBLISHED หรือ CLOSED                                           |
| POST `/:id/cancel`                            | `{version,reason}`                                                        | `{eventId,status,processed,remaining,failedBookingIds,pendingRefundCount,complete}`       |
| POST `/:id/zones`                             | `{code,name,sellingMode,capacity?,color?}`                                | Zone พร้อม pools; GA สร้าง pool ร่วมหนึ่งชุด                                              |
| PATCH `/:id/zones/:zoneId`                    | `{eventVersion,name,color}`                                               | Zone; แก้ชื่อ/สีได้ทุกสถานะยกเว้น CANCELLED/COMPLETED                                     |
| DELETE `/:id/zones/:zoneId`                   | `{eventVersion}`                                                          | DRAFT เท่านั้น; โซนต้องไม่มี unit/ticket type; ลบ pool และวัตถุผูกในร่างผัง               |
| POST `/:id/units`                             | `{zoneId,code,name,sellingMode,admissionCount,priceSatang,parentUnitId?}` | Unit + UnitInventory                                                                      |
| PATCH `/:id/units/:unitId`                    | `{version,status:AVAILABLE\|BLOCKED,reason}`                              | Inventory; ห้ามแตะหน่วยที่ถูกกันหรือขายแล้ว                                               |
| PATCH `/:id/units/:unitId/price`              | `{eventVersion,name,priceSatang,reason}`                                  | ราคาใหม่; ไม่แก้ BookingItem เดิม                                                         |
| DELETE `/:id/units/:unitId`                   | `{eventVersion}`                                                          | DRAFT เท่านั้น; ไม่มีประวัติจองและที่นั่งย่อย; ลบ inventory และวัตถุในร่างผัง             |
| POST `/:id/ticket-types`                      | `{zoneId,poolId,code,name,priceSatang,saleStartsAt,saleEndsAt}`           | TicketType ใช้ pool ในโซนเดียวกัน                                                         |
| PATCH `/:id/ticket-types/:ticketTypeId/price` | เหมือน unit price                                                         | ราคาใหม่                                                                                  |
| PATCH `/:id/ticket-types/:ticketTypeId`       | `{eventVersion,saleStartsAt,saleEndsAt,active,reason}`                    | ปรับช่วงขาย/เปิด-ปิดประเภทบัตร มีผลกับการจองใหม่เท่านั้น                                  |
| DELETE `/:id/ticket-types/:ticketTypeId`      | `{eventVersion}`                                                          | DRAFT เท่านั้น และไม่มีประวัติจอง                                                         |
| PATCH `/:id/pools/:poolId`                    | `{version,capacity,reason}`                                               | Pool; ลดได้ไม่เกิน available ที่เหลือ                                                     |
| GET `/:id/layout`                             | —                                                                         | Draft พร้อม `version` alias ของ revision                                                  |
| PUT `/:id/layout`                             | `{version,width,height,geometry:{objects}}`                               | Draft revision เพิ่ม + warnings                                                           |
| POST `/:id/layout/publish`                    | `{version}`                                                               | Immutable LayoutVersion + draftVersion + warnings                                         |

EventFields = slug,title,description,artists:string[],venue,posterUrl?,startsAt,endsAt,saleStartsAt,saleEndsAt วันสิ้นสุดต้องหลังวันเริ่มและช่วงขายสมเหตุสมผล slug lowercase a-z/0-9/hyphen; poster HTTPS หรือไฟล์ภายในเว็บ

การเพิ่มและลบโครงสร้าง zone/unit/type ทำได้เฉพาะ DRAFT การลบเป็น hard delete จึงทำได้เฉพาะรายการที่ไม่มีประวัติการจอง หน่วยที่มีประวัติไม่ถูกลบหรือเปลี่ยนสิทธิ์ย้อนหลัง ให้เลิกใช้งานผ่าน cancel/close/block/active=false เพื่อเก็บประวัติ ไม่ลบ Event/Booking ที่มีประวัติธุรกรรม slug และรหัส zone/unit/ticket type ที่ซ้ำได้ 409 `SLUG_TAKEN`/`CODE_TAKEN`

Geometry object: `{id,code,name?,label?,type,shape,x,y,width,height,rotation,zoneId?,unitId?,color?}`; type=`zone|stage|entrance|aisle|service|label|table|seat`; shape=`rect|circle`; world coordinates แยก viewport; IDs คงเดิมเมื่อขยับ ตรวจ bounds รวม rotation, duplicates, unit/zone references, overlap warning; TABLE/SEAT ต้องผูกหน่วยจริง ส่วน geometry ไม่มี authoritative price/stock

Cancel event ปิดงานก่อนแล้วจัดการครั้งละ 25 booking แต่ละรายการ atomic และมี durable retry receipt เรียกซ้ำจน remaining=0; stock คืนหนึ่งครั้ง บัตรถูก revoke และเงินรับจริงเข้าคิวคืนเงิน ไม่มีการลบประวัติ

## ตรวจเงินและคืนเงิน

ทุก action ต้อง ADMIN/SUPER_ADMIN

| Method และ path                                       | Input                                                        | data                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| GET `/admin/bookings`                                 | q,status,eventId,page,pageSize                               | `{bookings,total,page,pageSize,serverNow}`                                                         |
| POST `/admin/bookings/:id/approve`                    | `{version,reason,paymentAttemptId,receivedAmountSatang}`     | CONFIRMED; ยอดรับจริงเต็มจำนวน; stock SOLD; tickets ใน transaction เดียว                           |
| POST `/admin/bookings/:id/request-correction`         | `{version,reason}`                                           | ACTION_REQUIRED; คงสิทธิ์และหลักฐานเก่า                                                            |
| POST `/admin/bookings/:id/reject`                     | `{version,reason}`                                           | REJECTED สำหรับรอตรวจ/ขอแก้; คืนสิทธิ์                                                             |
| POST `/admin/bookings/:id/cancel`                     | `{version,reason}`                                           | CANCELLED; revoke tickets; pending refund เมื่อมีเงินจริง                                          |
| POST `/admin/bookings/:id/record-received`            | `{version,reason,assetId,declaredAmountSatang,transferTime}` | บันทึกเงินรับจริงครั้งเดียวบน EXPIRED/CANCELLED/REJECTED และสร้าง pending refund ไม่คืนชีพ booking |
| POST `/admin/bookings/:id/refunds`                    | `{version,reason}`                                           | RefundRecord หรือรายการเดิม; ยอดเต็มตาม verified payment                                           |
| POST `/admin/bookings/:id/refunds/:refundId/complete` | `{proofAssetId,reason}`                                      | REFUNDED เมื่อเจ้าหน้าที่บันทึกหลักฐานคืนเงินจริง                                                  |

late receipt ใช้ declaredAmountSatang เป็นยอดที่เจ้าหน้าที่ตรวจแล้วและยืนยันเองใน action นี้ ไม่ใช่การเชื่อยอดแจ้งของลูกค้า ไม่มีการตรวจธนาคารอัตโนมัติ ไม่รองรับแบ่งคืนหลายครั้งใน MVP

## Check-in / รายงาน / ผู้ดูแล

| Method และ path                 | Input                                                              | สิทธิ์ / data                                                         |
| ------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| POST `/check-in`                | `{eventId,token}`                                                  | ADMIN/SUPER_ADMIN ทุกงาน; atomic first-use                            |
| GET `/admin/reports`            | eventId?                                                           | ADMIN/SUPER_ADMIN; รายงานแยกสถานะและเงิน                              |
| GET `/admin/business-profile`   | —                                                                  | SUPER_ADMIN                                                           |
| PATCH `/admin/business-profile` | displayName,logo?,contact,paymentInstructions,bookingPolicy,theme? | SUPER_ADMIN; JSON objects ที่ผ่าน validation                          |
| GET `/admin/staff`              | q,page,pageSize                                                    | SUPER_ADMIN; `{items,total,page,pageSize}`                            |
| POST `/admin/staff`             | `{userId,role:CUSTOMER                                             | ADMIN                                                                 | SUPER_ADMIN,reason}` | SUPER_ADMIN; ไม่รับการสมัคร public เพิ่ม role |
| GET `/admin/audit`              | entityId?,page,pageSize                                            | SUPER_ADMIN; `{items,total,page,pageSize}` ไม่มี credentials          |
| POST `/jobs/expire`             | Bearer JOB_SECRET                                                  | `{examined,expired,more,serverNow,overdueReviews,overdueCorrections}` |

bookingPolicy={holdMinutes:1..60,reviewHours:1..168,correctionHours:1..168,terms}; BusinessProfile scalar policy fields อัปเดตพร้อม JSON ไม่ใช้ JSON เป็น query engine

รายงาน: statusTotals[status]={count,totalSatang,admissions},publishedEvents,reviewQueue,overdueReview,confirmedSatang,receivedSatang,refundedSatang,netReceivedSatang,soldAdmissions,checkedIn,pendingRefundCount,pendingRefundSatang,serverNow ยอดรับคิดจาก Booking.verifiedAmountSatang หนึ่งครั้ง ไม่รวม PaymentAttempt ซ้ำ; ยอดคืนเฉพาะ REFUNDED

checkedIn นับ CheckInLog ACCEPTED จึงรักษาประวัติผู้ที่เคยเข้างาน แม้บัตรถูกเพิกถอนในภายหลัง; soldAdmissions นับสิทธิ์ที่ยัง ACTIVE/USED เท่านั้น

## Errors

| HTTP | Code หลัก                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | UNAUTHENTICATED                                                                                                                                                   |
| 403  | FORBIDDEN                                                                                                                                                         |
| 404  | NOT_FOUND                                                                                                                                                         |
| 409  | EVENT_NOT_ON_SALE, INVENTORY_UNAVAILABLE, HOLD_EXPIRED, INVALID_TRANSITION, IDEMPOTENCY_CONFLICT, VERSION_CONFLICT, CONFLICT, TICKET_ALREADY_USED, TICKET_REVOKED |
| 413  | PAYLOAD_TOO_LARGE                                                                                                                                                 |
| 422  | VALIDATION_ERROR                                                                                                                                                  |
| 429  | RATE_LIMITED                                                                                                                                                      |
| 503  | SERVICE_UNAVAILABLE, SETUP_REQUIRED                                                                                                                               |

ไม่คืน Prisma error, stack trace, storage path, passwords, session tokens หรือ QR credential ใน error envelope
