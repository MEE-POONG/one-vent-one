# OneVentOne
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-specified Next.js App Router, TypeScript, Tailwind CSS, Prisma 6.19.3, MongoDB replica set, react-konva for layout editing.

## Users
One installation per shop (not a multi-shop marketplace). Customers who book; ADMIN staff who run the website day to day (events, bookings, payment review, refunds, check-in, reports); the SUPER_ADMIN shop owner, who also manages staff, shop settings and the audit log. Case-study seed business: ร้านมงคลบาร์.

## Product Purpose
OneVentOne manages events, whole tables, individual seats and general admission reservations, manual bank-transfer review, tickets and first-use check-in in one application.

## Operating Context
Public booking works on phones. A table admits the configured number of people. Holds last 15 minutes by default. Uploaded evidence awaits staff verification before ticket issuance. Staff work with readable administrative tables and a desktop-first two-dimensional venue editor.

## Capabilities and Constraints
One business per deployment and many events; THB stored as integer satang; UTC storage with Asia/Bangkok display; private payment evidence; server-authoritative prices, inventory, permissions and status. No production deployment, gateway, money transfer, multi-tenant SaaS, resale or 3D.

## Brand Commitments
OneVentOne product name, Thai interface, red/black/gray palette: #0B0B0F background, #18181B and #27272A surfaces, #E11D48 primary, #F4F4F5 text. Business identity comes from BusinessProfile. Slow red pulse and pointer highlights used selectively with reduced-motion support.

## Evidence on Hand
User-provided OneVentOne_Development_Prompts.txt is the functional and visual brief. No real customer photographs, verified sales figures, endorsements or production financial account details were supplied.

## Product Principles
- Booking state is confirmed by the server.
- A slip is evidence, not proof that money was received.
- Explain admission counts and reservation deadlines clearly.
- Show recovery actions and preserve retries after network failures.

## Accessibility & Inclusion
360px mobile layouts, keyboard focus, text alongside status colors, reduced motion and equivalent text controls for canvas selection/editing.

## Working Assumptions
Derived only from supplied brief: a restrained concert-poster public surface and task-focused administration. No additional product claims are introduced.
