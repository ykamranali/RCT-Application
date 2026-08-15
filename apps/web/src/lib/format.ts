import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { differenceInMinutes, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';

import { APP_CURRENCY, APP_LOCALE, APP_TIMEZONE } from '@rct/types';

/**
 * All user-facing date formatting goes through here.
 *
 * The database stores timestamptz (UTC on the wire); the business runs on
 * Gulf Standard Time. Formatting anywhere else in the app risks rendering a
 * ticket that was raised at 09:00 in Dubai as 05:00, which is exactly the
 * kind of bug that erodes trust in an SLA report.
 */

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : parseISO(value);
  return isValid(date) ? date : null;
}

/** 15-Aug-2026 */
export function formatDate(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return formatInTimeZone(date, APP_TIMEZONE, 'dd-MMM-yyyy');
}

/** 15-Aug-2026 14:32 */
export function formatDateTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return formatInTimeZone(date, APP_TIMEZONE, 'dd-MMM-yyyy HH:mm');
}

/** 14:32 */
export function formatTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return formatInTimeZone(date, APP_TIMEZONE, 'HH:mm');
}

/** Thu 15 Aug, 14:32 — used on the ticket timeline. */
export function formatTimelineStamp(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return formatInTimeZone(date, APP_TIMEZONE, 'EEE dd MMM, HH:mm');
}

/** "3 hours ago" */
export function formatRelative(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** Local wall-clock time in Dubai, for date pickers. */
export function toDubaiTime(value: DateInput): Date | null {
  const date = toDate(value);
  return date ? toZonedTime(date, APP_TIMEZONE) : null;
}

/**
 * Human duration from a minute count.
 *   90    -> "1h 30m"
 *   2880  -> "2d"
 *   -45   -> "45m overdue"
 */
export function formatDuration(minutes: number | null | undefined, fallback = '—'): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return fallback;

  const overdue = minutes < 0;
  let remaining = Math.round(Math.abs(minutes));

  if (remaining < 1) return overdue ? 'just overdue' : 'less than a minute';

  const days = Math.floor(remaining / 1440);
  remaining -= days * 1440;
  const hours = Math.floor(remaining / 60);
  const mins = remaining - hours * 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  // Only show minutes when the total is short enough for them to matter.
  if (mins && days === 0) parts.push(`${mins}m`);

  const text = parts.join(' ') || `${mins}m`;
  return overdue ? `${text} overdue` : text;
}

/** Elapsed time between two instants, as a duration string. */
export function formatElapsed(from: DateInput, to: DateInput): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return '—';
  return formatDuration(differenceInMinutes(end, start));
}

/** AED 1,250.00 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = APP_CURRENCY,
  fallback = '—',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return new Intl.NumberFormat(APP_LOCALE).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
  fallback = '—',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${value.toFixed(digits)}%`;
}

/** 1.2 MB */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** "ON_SITE" -> "On site" */
export function humaniseEnum(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function truncate(value: string | null | undefined, max = 80): string {
  if (!value) return '';
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Safe filename for downloads: Service_Report_SR-2026-000001.pdf */
export function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_{2,}/g, '_');
}
