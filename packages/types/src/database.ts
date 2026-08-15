/**
 * Database row shapes for the tables and views the applications read.
 *
 * This file is hand-maintained so the repository type-checks before anyone
 * has a Supabase project. Once your project exists you can regenerate a
 * fully exhaustive version with:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public \
 *     > packages/types/src/database.generated.ts
 *
 * and re-export it from here. The shapes below match the migrations, so the
 * generated file is a superset rather than a replacement.
 */

import type {
  AmcStatus,
  AssetStatus,
  CustomerType,
  EmailStatus,
  PriorityCode,
  RecordStatus,
  SlaState,
  TicketStatus,
  UserRole,
  VisitStage,
} from './domain';

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
export type UUID = string;
/** ISO-8601 timestamp with timezone, as returned by PostgREST. */
export type Timestamp = string;
export type DateOnly = string;

// ---------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------

export interface Profile {
  id: UUID;
  email: string | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  employee_id: UUID | null;
  customer_id: UUID | null;
  branch_id: UUID | null;
  is_active: boolean;
  must_change_password: boolean;
  locale: string;
  timezone: string;
  last_login_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Customer {
  id: UUID;
  customer_code: string;
  company_name: string;
  trade_licence_no: string | null;
  tax_registration_no: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  emirate: string | null;
  country: string;
  customer_type: CustomerType;
  contract_number: string | null;
  amc_start_date: DateOnly | null;
  amc_expiry_date: DateOnly | null;
  sla_plan_id: UUID | null;
  account_manager_id: UUID | null;
  status: RecordStatus;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Branch {
  id: UUID;
  customer_id: UUID;
  branch_code: string;
  branch_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  emirate: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  working_hours: string | null;
  site_notes: string | null;
  is_head_office: boolean;
  status: RecordStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Employee {
  id: UUID;
  employee_code: string;
  profile_id: UUID | null;
  full_name: string;
  email: string;
  phone: string | null;
  alternate_phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department_id: UUID | null;
  role: UserRole;
  reports_to: UUID | null;
  joining_date: DateOnly | null;
  status: RecordStatus;
  max_open_tickets: number;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Category {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  colour: string | null;
  sort_order: number;
  default_priority_id: UUID | null;
  is_active: boolean;
}

export interface Subcategory {
  id: UUID;
  category_id: UUID;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Priority {
  id: UUID;
  code: PriorityCode | string;
  name: string;
  description: string | null;
  severity: number;
  colour: string;
  is_default: boolean;
  is_active: boolean;
}

export interface SlaPlan {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  is_24x7: boolean;
  pause_on_hold: boolean;
  timezone: string;
  at_risk_threshold: number;
  is_default: boolean;
  is_active: boolean;
}

export interface SlaRule {
  id: UUID;
  sla_plan_id: UUID;
  priority_id: UUID;
  response_minutes: number;
  resolution_minutes: number;
  escalation_1_minutes: number | null;
  escalation_2_minutes: number | null;
}

export interface Ticket {
  id: UUID;
  ticket_number: string;
  customer_id: UUID;
  branch_id: UUID | null;
  asset_id: UUID | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  category_id: UUID | null;
  subcategory_id: UUID | null;
  priority_id: UUID;
  subject: string;
  description: string;
  status: TicketStatus;
  created_by: UUID | null;
  assigned_engineer_id: UUID | null;
  service_manager_id: UUID | null;
  created_at: Timestamp;
  assigned_at: Timestamp | null;
  accepted_at: Timestamp | null;
  first_response_at: Timestamp | null;
  work_started_at: Timestamp | null;
  on_site_at: Timestamp | null;
  resolved_at: Timestamp | null;
  closed_at: Timestamp | null;
  reopened_at: Timestamp | null;
  cancelled_at: Timestamp | null;
  updated_at: Timestamp;
  preferred_visit_at: Timestamp | null;
  sla_plan_id: UUID | null;
  response_due_at: Timestamp | null;
  resolution_due_at: Timestamp | null;
  response_state: SlaState;
  resolution_state: SlaState;
  paused_ms: number;
  paused_since: Timestamp | null;
  diagnosis: string | null;
  work_performed: string | null;
  resolution_summary: string | null;
  engineer_remarks: string | null;
  customer_remarks: string | null;
  root_cause: string | null;
  cancellation_reason: string | null;
  reopen_count: number;
  is_billable: boolean;
}

/** Shape returned by public.v_tickets_overview. */
export interface TicketOverview {
  id: UUID;
  ticket_number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  created_at: Timestamp;
  assigned_at: Timestamp | null;
  accepted_at: Timestamp | null;
  first_response_at: Timestamp | null;
  resolved_at: Timestamp | null;
  closed_at: Timestamp | null;
  reopened_at: Timestamp | null;
  reopen_count: number;
  preferred_visit_at: Timestamp | null;
  resolution_summary: string | null;
  diagnosis: string | null;
  work_performed: string | null;
  engineer_remarks: string | null;
  customer_remarks: string | null;
  is_billable: boolean;
  customer_id: UUID;
  customer_name: string | null;
  customer_code: string | null;
  branch_id: UUID | null;
  branch_name: string | null;
  branch_city: string | null;
  branch_emirate: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  category_id: UUID | null;
  category_name: string | null;
  category_colour: string | null;
  subcategory_id: UUID | null;
  subcategory_name: string | null;
  priority_id: UUID;
  priority_code: string | null;
  priority_name: string | null;
  priority_severity: number | null;
  priority_colour: string | null;
  assigned_engineer_id: UUID | null;
  engineer_name: string | null;
  engineer_code: string | null;
  service_manager_id: UUID | null;
  service_manager_name: string | null;
  asset_id: UUID | null;
  asset_tag: string | null;
  asset_name: string | null;
  sla_plan_id: UUID | null;
  response_due_at: Timestamp | null;
  resolution_due_at: Timestamp | null;
  response_state: SlaState;
  resolution_state: SlaState;
  sla_paused: boolean;
  resolution_remaining_minutes: number | null;
  response_minutes_actual: number | null;
  resolution_minutes_actual: number | null;
  service_report_id: UUID | null;
  report_number: string | null;
  service_report_path: string | null;
  customer_rating: number | null;
  public_comment_count: number;
  attachment_count: number;
}

export interface TicketStatusHistory {
  id: UUID;
  ticket_id: UUID;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  event_type: string;
  note: string | null;
  changed_by: UUID | null;
  changed_by_name: string | null;
  metadata: Json;
  created_at: Timestamp;
}

export interface TicketComment {
  id: UUID;
  ticket_id: UUID;
  author_id: UUID | null;
  author_name: string | null;
  author_role: UserRole | null;
  body: string;
  is_internal: boolean;
  is_system: boolean;
  edited_at: Timestamp | null;
  created_at: Timestamp;
}

export interface TicketAttachment {
  id: UUID;
  ticket_id: UUID;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: string;
  uploaded_by: UUID | null;
  is_internal: boolean;
  scan_status: string;
  created_at: Timestamp;
}

export interface TicketPart {
  id: UUID;
  ticket_id: UUID;
  part_id: UUID | null;
  part_name: string;
  serial_number: string | null;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  currency: string;
  is_billable: boolean;
  is_replacement: boolean;
  remarks: string | null;
  recorded_by: UUID | null;
  created_at: Timestamp;
  total_cost: number;
}

export interface TicketTimeEntry {
  id: UUID;
  ticket_id: UUID;
  engineer_id: UUID;
  started_at: Timestamp;
  ended_at: Timestamp | null;
  activity: string;
  is_overtime: boolean;
  notes: string | null;
  created_at: Timestamp;
  minutes_spent: number | null;
}

export interface TicketVisit {
  id: UUID;
  ticket_id: UUID;
  engineer_id: UUID;
  stage: VisitStage;
  occurred_at: Timestamp;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  notes: string | null;
  created_at: Timestamp;
}

export interface ServiceReport {
  id: UUID;
  report_number: string;
  ticket_id: UUID;
  customer_id: UUID;
  branch_id: UUID | null;
  engineer_id: UUID | null;
  snapshot: Json;
  complaint_summary: string | null;
  diagnosis: string | null;
  work_performed: string | null;
  engineer_remarks: string | null;
  customer_remarks: string | null;
  parts_summary: Json;
  service_started_at: Timestamp | null;
  arrival_at: Timestamp | null;
  completion_at: Timestamp | null;
  total_minutes: number | null;
  customer_signature_id: UUID | null;
  engineer_signature_id: UUID | null;
  customer_signed_name: string | null;
  engineer_signed_name: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  pdf_generated_at: Timestamp | null;
  pdf_version: number;
  final_status: TicketStatus;
  is_approved: boolean;
  approved_at: Timestamp | null;
  generated_by: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CustomerSignature {
  id: UUID;
  ticket_id: UUID;
  signer_type: 'customer' | 'engineer';
  signer_name: string;
  signer_title: string | null;
  signer_email: string | null;
  storage_path: string;
  content_hash: string;
  signed_at: Timestamp;
  captured_by: UUID | null;
  created_at: Timestamp;
}

export interface CustomerFeedback {
  id: UUID;
  ticket_id: UUID;
  customer_id: UUID;
  engineer_id: UUID | null;
  submitted_by: UUID | null;
  issue_resolved: boolean | null;
  overall_rating: number;
  engineer_rating: number | null;
  service_rating: number | null;
  response_rating: number | null;
  comments: string | null;
  requested_at: Timestamp | null;
  submitted_at: Timestamp;
  created_at: Timestamp;
}

export interface AmcContract {
  id: UUID;
  amc_number: string;
  customer_id: UUID;
  contract_type: string;
  sla_plan_id: UUID | null;
  start_date: DateOnly;
  expiry_date: DateOnly;
  renewal_notice_days: number;
  auto_renew: boolean;
  covered_services: string[];
  excluded_services: string[];
  visits_included: number | null;
  visits_consumed: number;
  contract_value: number | null;
  currency: string;
  payment_terms: string | null;
  billing_frequency: string | null;
  status: AmcStatus;
  document_url: string | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Asset {
  id: UUID;
  asset_tag: string;
  customer_id: UUID;
  branch_id: UUID | null;
  asset_type_id: UUID | null;
  amc_contract_id: UUID | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: DateOnly | null;
  installation_date: DateOnly | null;
  warranty_expiry: DateOnly | null;
  ip_address: string | null;
  mac_address: string | null;
  hostname: string | null;
  operating_system: string | null;
  location_detail: string | null;
  status: AssetStatus;
  criticality: number;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AppNotification {
  id: UUID;
  recipient_id: UUID;
  type: string;
  title: string;
  body: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  link_url: string | null;
  ticket_id: UUID | null;
  metadata: Json;
  read_at: Timestamp | null;
  created_at: Timestamp;
}

export interface EmailTemplate {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  send_to_customer: boolean;
  send_to_engineer: boolean;
  send_to_management: boolean;
  attach_report: boolean;
  is_active: boolean;
  is_system: boolean;
  updated_at: Timestamp;
}

export interface EmailLog {
  id: UUID;
  template_code: string | null;
  ticket_id: UUID | null;
  service_report_id: UUID | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  from_address: string | null;
  reply_to: string | null;
  subject: string;
  body_preview: string | null;
  attachments: Json;
  provider: string | null;
  provider_message_id: string | null;
  status: EmailStatus;
  attempts: number;
  last_error: string | null;
  queued_at: Timestamp;
  sent_at: Timestamp | null;
}

export interface AuditLog {
  id: number;
  occurred_at: Timestamp;
  actor_id: UUID | null;
  actor_name: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  summary: string | null;
  changed_fields: string[] | null;
  old_values: Json;
  new_values: Json;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
}

export interface SystemSetting {
  key: string;
  value: Json;
  category: string;
  label: string | null;
  description: string | null;
  is_secret: boolean;
  updated_at: Timestamp;
}

/** Shape returned by public.dashboard_stats(). */
export interface DashboardStats {
  total_tickets: number;
  new_tickets: number;
  open_tickets: number;
  in_progress: number;
  on_hold: number;
  resolved: number;
  closed: number;
  cancelled: number;
  reopened: number;
  overdue: number;
  sla_at_risk: number;
  sla_breached: number;
  sla_compliance: number | null;
  avg_resolution_hours: number | null;
  avg_response_minutes: number | null;
  csat: number | null;
  by_status: Record<string, number>;
  by_priority: { code: string; name: string; colour: string; count: number }[];
  by_category: { name: string; colour: string | null; count: number }[];
  monthly_trend: { month: string; created: number; resolved: number }[];
}

export interface EngineerPerformance {
  engineer_id: UUID;
  employee_code: string;
  engineer_name: string;
  period_month: DateOnly;
  tickets_assigned: number;
  tickets_accepted: number;
  tickets_completed: number;
  tickets_open: number;
  tickets_cancelled: number;
  tickets_reopened: number;
  response_sla_met: number;
  response_sla_breached: number;
  resolution_sla_met: number;
  resolution_sla_breached: number;
  sla_compliance_percent: number | null;
  avg_response_minutes: number | null;
  avg_resolution_minutes: number | null;
  site_visits: number;
  avg_customer_rating: number | null;
  feedback_count: number;
  poor_ratings: number;
  labour_minutes: number;
  overtime_minutes: number;
  parts_cost: number;
}

export interface CustomerSummary {
  customer_id: UUID;
  customer_code: string;
  company_name: string;
  customer_type: CustomerType;
  status: RecordStatus;
  amc_expiry_date: DateOnly | null;
  total_tickets: number;
  open_tickets: number;
  completed_tickets: number;
  sla_breaches: number;
  reopened_tickets: number;
  avg_resolution_hours: number | null;
  avg_rating: number | null;
  branch_count: number;
  asset_count: number;
  active_contracts: number;
}

export interface AmcExpiring {
  id: UUID;
  amc_number: string;
  customer_id: UUID;
  company_name: string;
  contract_type: string;
  start_date: DateOnly;
  expiry_date: DateOnly;
  contract_value: number | null;
  currency: string;
  status: AmcStatus;
  days_remaining: number;
  expiry_bucket: 'expired' | 'within_30_days' | 'within_60_days' | 'within_90_days' | 'later';
}

export interface SearchResult {
  kind: 'ticket' | 'customer' | 'engineer' | 'asset' | 'amc' | 'service_report';
  id: UUID;
  label: string;
  sublabel: string | null;
  url: string;
  rank: number;
}

// ---------------------------------------------------------------------
// Insert / update helpers
// ---------------------------------------------------------------------

/** Columns the database fills in for you on every table. */
type Managed = 'id' | 'created_at' | 'updated_at';

export type Insert<T, Optional extends keyof T = never> = Omit<T, Managed | Optional> &
  Partial<Pick<T, Extract<Managed | Optional, keyof T>>>;

export type Update<T> = Partial<Omit<T, Managed>>;

export type TicketInsert = Insert<
  Ticket,
  | 'ticket_number'
  | 'status'
  | 'response_due_at'
  | 'resolution_due_at'
  | 'response_state'
  | 'resolution_state'
  | 'paused_ms'
  | 'reopen_count'
  | 'is_billable'
  | 'sla_plan_id'
>;
export type TicketUpdate = Update<Ticket>;
export type CustomerInsert = Insert<Customer, 'country' | 'status' | 'customer_type'>;
export type BranchInsert = Insert<Branch, 'country' | 'status' | 'is_head_office'>;
