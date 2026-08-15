/**
 * RCT Application - shared domain vocabulary.
 *
 * These literal unions mirror the PostgreSQL enum types declared in
 * supabase/migrations/0001_foundation.sql. Keeping them in a shared package
 * means the web app and the mobile app cannot drift apart, and a status the
 * database rejects will not compile on the client either.
 */

export const USER_ROLES = [
  'super_admin',
  'admin',
  'management',
  'service_manager',
  'engineer',
  'customer_admin',
  'customer_user',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TICKET_STATUSES = [
  'NEW',
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'ON_SITE',
  'ON_HOLD',
  'PENDING_CUSTOMER',
  'PENDING_PARTS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const SLA_STATES = ['met', 'at_risk', 'breached', 'not_applicable', 'pending'] as const;
export type SlaState = (typeof SLA_STATES)[number];

export const AMC_STATUSES = ['ACTIVE', 'EXPIRING', 'EXPIRED', 'SUSPENDED', 'CANCELLED'] as const;
export type AmcStatus = (typeof AMC_STATUSES)[number];

export const ASSET_STATUSES = ['IN_SERVICE', 'IN_REPAIR', 'STANDBY', 'RETIRED', 'DISPOSED'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const VISIT_STAGES = [
  'TRAVEL_STARTED',
  'ARRIVED',
  'WORK_STARTED',
  'PAUSED',
  'RESUMED',
  'WORK_COMPLETED',
  'DEPARTED',
] as const;
export type VisitStage = (typeof VISIT_STAGES)[number];

export const CUSTOMER_TYPES = ['AMC', 'ON_CALL', 'PROJECT', 'WARRANTY', 'INTERNAL'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const RECORD_STATUSES = ['active', 'inactive', 'suspended', 'archived'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const EMAIL_STATUSES = ['queued', 'sending', 'sent', 'failed', 'bounced'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const PRIORITY_CODES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type PriorityCode = (typeof PRIORITY_CODES)[number];

/** The seven emirates, used for address pickers. Not a closed set in the
 *  database - customers outside the UAE simply store a different value. */
export const EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const;
export type Emirate = (typeof EMIRATES)[number];

// ---------------------------------------------------------------------
// Presentation metadata
// ---------------------------------------------------------------------

export interface StatusMeta {
  label: string;
  /** Tailwind classes for the chip; paired with the `.chip` base class. */
  className: string;
  /** True while the ticket is still consuming engineer time. */
  isOpen: boolean;
  /** True when the SLA clock is stopped in this status. */
  isPaused: boolean;
}

export const TICKET_STATUS_META: Record<TicketStatus, StatusMeta> = {
  NEW: {
    label: 'New',
    className: 'bg-info-soft text-info ring-info/25',
    isOpen: true,
    isPaused: false,
  },
  ASSIGNED: {
    label: 'Assigned',
    className: 'bg-info-soft text-info ring-info/25',
    isOpen: true,
    isPaused: false,
  },
  ACCEPTED: {
    label: 'Accepted',
    className: 'bg-primary/10 text-primary ring-primary/25',
    isOpen: true,
    isPaused: false,
  },
  IN_PROGRESS: {
    label: 'In progress',
    className: 'bg-primary/10 text-primary ring-primary/25',
    isOpen: true,
    isPaused: false,
  },
  ON_SITE: {
    label: 'On site',
    className: 'bg-primary/15 text-primary ring-primary/30',
    isOpen: true,
    isPaused: false,
  },
  ON_HOLD: {
    label: 'On hold',
    className: 'bg-warning-soft text-warning ring-warning/25',
    isOpen: true,
    isPaused: true,
  },
  PENDING_CUSTOMER: {
    label: 'Pending customer',
    className: 'bg-warning-soft text-warning ring-warning/25',
    isOpen: true,
    isPaused: true,
  },
  PENDING_PARTS: {
    label: 'Pending parts',
    className: 'bg-warning-soft text-warning ring-warning/25',
    isOpen: true,
    isPaused: true,
  },
  RESOLVED: {
    label: 'Resolved',
    className: 'bg-success-soft text-success ring-success/25',
    isOpen: false,
    isPaused: false,
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-muted text-muted-foreground ring-border',
    isOpen: false,
    isPaused: false,
  },
  REOPENED: {
    label: 'Reopened',
    className: 'bg-danger-soft text-danger ring-danger/25',
    isOpen: true,
    isPaused: false,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-muted text-muted-foreground ring-border line-through',
    isOpen: false,
    isPaused: false,
  },
};

export const SLA_STATE_META: Record<SlaState, { label: string; className: string; dot: string }> = {
  met: {
    label: 'On track',
    className: 'bg-success-soft text-success ring-success/25',
    dot: 'bg-success',
  },
  at_risk: {
    label: 'At risk',
    className: 'bg-warning-soft text-warning ring-warning/25',
    dot: 'bg-warning',
  },
  breached: {
    label: 'Breached',
    className: 'bg-danger-soft text-danger ring-danger/25',
    dot: 'bg-danger',
  },
  not_applicable: {
    label: 'No SLA',
    className: 'bg-muted text-muted-foreground ring-border',
    dot: 'bg-muted-foreground',
  },
  pending: {
    label: 'Pending',
    className: 'bg-muted text-muted-foreground ring-border',
    dot: 'bg-muted-foreground',
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  management: 'Management',
  service_manager: 'Service Manager',
  engineer: 'Engineer',
  customer_admin: 'Customer Administrator',
  customer_user: 'Customer User',
};

/** Roles that belong to Ram Computer Technology rather than to a customer. */
export const STAFF_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'management',
  'service_manager',
  'engineer',
];

export const MANAGEMENT_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'management',
  'service_manager',
];

export const ADMIN_ROLES: readonly UserRole[] = ['super_admin', 'admin'];

export const CUSTOMER_ROLES: readonly UserRole[] = ['customer_admin', 'customer_user'];

export function isStaff(role: UserRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}
export function isManagement(role: UserRole | null | undefined): boolean {
  return !!role && MANAGEMENT_ROLES.includes(role);
}
export function isAdmin(role: UserRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}
export function isCustomer(role: UserRole | null | undefined): boolean {
  return !!role && CUSTOMER_ROLES.includes(role);
}

/** Where a principal lands after signing in. */
export function landingPathForRole(role: UserRole): string {
  if (isCustomer(role)) return '/portal';
  if (role === 'engineer') return '/engineer';
  return '/dashboard';
}

/**
 * Legal next statuses. Mirrors app.allowed_transitions() in
 * supabase/migrations/0012_ticket_workflow.sql - the database is the
 * authority, this copy exists so the UI can render only valid actions
 * without a round trip.
 */
export const ALLOWED_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ['ASSIGNED', 'ACCEPTED', 'ON_HOLD', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  ACCEPTED: [
    'IN_PROGRESS',
    'ON_SITE',
    'ON_HOLD',
    'PENDING_CUSTOMER',
    'PENDING_PARTS',
    'ASSIGNED',
    'CANCELLED',
  ],
  IN_PROGRESS: [
    'ON_SITE',
    'ON_HOLD',
    'PENDING_CUSTOMER',
    'PENDING_PARTS',
    'RESOLVED',
    'ASSIGNED',
    'CANCELLED',
  ],
  ON_SITE: ['IN_PROGRESS', 'ON_HOLD', 'PENDING_CUSTOMER', 'PENDING_PARTS', 'RESOLVED', 'CANCELLED'],
  ON_HOLD: [
    'ACCEPTED',
    'IN_PROGRESS',
    'ON_SITE',
    'PENDING_CUSTOMER',
    'PENDING_PARTS',
    'RESOLVED',
    'CANCELLED',
  ],
  PENDING_CUSTOMER: ['IN_PROGRESS', 'ON_SITE', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
  PENDING_PARTS: ['IN_PROGRESS', 'ON_SITE', 'ON_HOLD', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED', 'IN_PROGRESS'],
  CLOSED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ON_SITE', 'ON_HOLD', 'CANCELLED'],
  CANCELLED: ['REOPENED'],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Statuses in which the SLA clock is stopped. */
export const PAUSED_STATUSES: readonly TicketStatus[] = [
  'ON_HOLD',
  'PENDING_CUSTOMER',
  'PENDING_PARTS',
];

export const OPEN_STATUSES: readonly TicketStatus[] = TICKET_STATUSES.filter(
  (s) => TICKET_STATUS_META[s].isOpen,
);

export const TERMINAL_STATUSES: readonly TicketStatus[] = ['CLOSED', 'CANCELLED'];

// ---------------------------------------------------------------------
// Upload constraints - kept in sync with the CHECK constraint on
// ticket_attachments.mime_type.
// ---------------------------------------------------------------------

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const STORAGE_BUCKETS = {
  attachments: 'ticket-attachments',
  reports: 'service-reports',
  signatures: 'signatures',
  avatars: 'avatars',
  company: 'company',
} as const;

export const APP_TIMEZONE = 'Asia/Dubai';
export const APP_CURRENCY = 'AED';
export const APP_LOCALE = 'en-AE';

export const BRANDING = {
  applicationName: 'RCT Application',
  companyName: 'Ram Computer Technology LLC',
  shortName: 'RCT',
  tagline: 'Service Management',
} as const;
