export type InventoryStatus =
  "AVAILABLE" | "HELD" | "REVIEW_RESERVED" | "SOLD" | "BLOCKED";
export interface Business {
  displayName: string;
  logo?: string | null;
  contact: Record<string, unknown>;
  paymentInstructions: Record<string, unknown>;
  bookingPolicy: Record<string, unknown>;
  holdMinutes: number;
  version: number;
}
export interface Unit {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  sellingMode: string;
  priceSatang: number;
  admissionCount: number;
  active: boolean;
  inventory?: { status: InventoryStatus };
  status?: InventoryStatus;
}
export interface Pool {
  id: string;
  zoneId: string;
  code: string;
  name?: string;
  capacity: number;
  available: number;
  held: number;
  reviewReserved: number;
  sold: number;
  blocked: number;
}
export interface TicketType {
  id: string;
  zoneId: string;
  poolId: string;
  name: string;
  code: string;
  priceSatang: number;
  saleStartsAt: string;
  saleEndsAt: string;
  active: boolean;
}
export interface Zone {
  id: string;
  code: string;
  name: string;
  color: string;
  sellingMode: string;
  units?: Unit[];
  ticketTypes?: TicketType[];
  pool?: Pool | null;
}
export interface LayoutObject {
  id: string;
  type:
    | "stage"
    | "zone"
    | "table"
    | "seat"
    | "entrance"
    | "aisle"
    | "service"
    | "label";
  shape: "rect" | "circle";
  code: string;
  name: string;
  label?: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zoneId?: string;
  unitId?: string;
}
export interface VenueLayout {
  id?: string;
  width: number;
  height: number;
  version?: number;
  revision?: number;
  geometry: { objects: LayoutObject[] };
}
export interface EventData {
  id: string;
  slug: string;
  title: string;
  description: string;
  artists: string[];
  venue: string;
  posterUrl?: string | null;
  startsAt: string;
  endsAt: string;
  saleStartsAt: string;
  saleEndsAt: string;
  status: string;
  version: number;
  zones?: Zone[];
  units?: Unit[];
  pools?: Pool[];
  ticketTypes?: TicketType[];
  layout?: VenueLayout | null;
  publishedLayoutVersion?: VenueLayout | null;
  minPriceSatang?: number | null;
  cancellationProcessedAt?: string | null;
  // Admin-only counts.
  bookingCount?: number;
  activeBookingCount?: number;
  serverNow?: string;
  _count?: { bookings: number };
}
export interface Availability {
  eventId: string;
  serverNow: string;
  units: Unit[];
  pools: Pool[];
  ticketTypes: TicketType[];
  layout: VenueLayout | null;
}
export interface BookingItem {
  id: string;
  sellingMode: string;
  unitId?: string | null;
  ticketTypeId?: string | null;
  quantity: number;
  admissionCount: number;
  unitPriceSatang: number;
  subtotalSatang: number;
  snapshot: Record<string, unknown>;
}
export interface Payment {
  id: string;
  assetId: string;
  declaredAmountSatang: number;
  transferTime: string;
  status: string;
  reviewReason?: string | null;
  receivedAmountSatang?: number | null;
  duplicateEvidenceWarning?: boolean;
}
export interface Refund {
  id: string;
  amountSatang: number;
  status: string;
  reason: string;
}
export interface Booking {
  id: string;
  bookingNumber: string;
  eventId: string;
  status: string;
  totalSatang: number;
  holdExpiresAt: string;
  reviewDueAt?: string | null;
  correctionDueAt?: string | null;
  version: number;
  reason?: string | null;
  items: BookingItem[];
  payments: Payment[];
  refunds: Refund[];
  event: EventData;
  serverNow: string;
  createdAt?: string;
  snapshot?: {
    paymentMode?: "DEMO_QR";
    paymentInstructions?: Record<string, unknown>;
    policy?: Record<string, unknown>;
    businessName?: string;
  };
  auditTimeline?: {
    action: string;
    reason?: string | null;
    createdAt: string;
  }[];
}
export interface Ticket {
  id: string;
  status: string;
  admissionSequence: number;
  token: string;
  usedAt?: string | null;
  itemLabel: string;
}
export interface VerifiedTicketInspection {
  valid: boolean;
  ticketId: string;
  token: string;
  status: "ACTIVE" | "USED" | "REVOKED" | string;
  admissionSequence: number;
  totalItemAdmissions: number;
  sellingMode: string;
  itemLabel: string;
  unitCode: string | null;
  zoneName: string;
  holderName: string;
  isGuestBooking: boolean;
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    totalSatang: number;
    totalAdmissions: number;
    confirmedAt: string | null;
    createdAt: string;
    paymentMethod: string;
  };
  event: {
    id: string;
    slug: string;
    title: string;
    venue: string;
    artists: string[];
    posterUrl?: string | null;
    startsAt: string;
    endsAt: string;
    status: string;
  };
  verification: {
    verificationCode: string;
    sha256Fingerprint: string;
    fullHashPrefix: string;
    encryptionSuite: string;
    layoutVersionId: string;
    issuedAt: string;
    usedAt: string | null;
    usedByStaff: string | null;
    revokedAt: string | null;
    checkInAttempts: number;
    serverVerifiedAt: string;
  };
}
export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
