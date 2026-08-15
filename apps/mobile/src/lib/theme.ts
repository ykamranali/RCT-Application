/** Shared tokens, matched to the web application's design system. */
export const theme = {
  colour: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    ink: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    brand: '#0E4FA1',
    sidebar: '#0F172A',
    success: '#15803D',
    successSoft: '#F0FDF4',
    warning: '#B45309',
    warningSoft: '#FFFBEB',
    danger: '#B91C1C',
    dangerSoft: '#FEF2F2',
    infoSoft: '#EFF6FF',
  },
  radius: { sm: 8, md: 10, lg: 14 },
  space: (n: number) => n * 4,
} as const;

export const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  NEW: { bg: theme.colour.infoSoft, fg: '#1D4ED8' },
  ASSIGNED: { bg: theme.colour.infoSoft, fg: '#1D4ED8' },
  ACCEPTED: { bg: '#EFF6FF', fg: theme.colour.brand },
  IN_PROGRESS: { bg: '#EFF6FF', fg: theme.colour.brand },
  ON_SITE: { bg: '#DBEAFE', fg: theme.colour.brand },
  ON_HOLD: { bg: theme.colour.warningSoft, fg: theme.colour.warning },
  PENDING_CUSTOMER: { bg: theme.colour.warningSoft, fg: theme.colour.warning },
  PENDING_PARTS: { bg: theme.colour.warningSoft, fg: theme.colour.warning },
  RESOLVED: { bg: theme.colour.successSoft, fg: theme.colour.success },
  CLOSED: { bg: '#F1F5F9', fg: theme.colour.muted },
  REOPENED: { bg: theme.colour.dangerSoft, fg: theme.colour.danger },
  CANCELLED: { bg: '#F1F5F9', fg: theme.colour.muted },
};

export const SLA_TONE: Record<string, { bg: string; fg: string }> = {
  met: { bg: theme.colour.successSoft, fg: theme.colour.success },
  at_risk: { bg: theme.colour.warningSoft, fg: theme.colour.warning },
  breached: { bg: theme.colour.dangerSoft, fg: theme.colour.danger },
  not_applicable: { bg: '#F1F5F9', fg: theme.colour.muted },
  pending: { bg: '#F1F5F9', fg: theme.colour.muted },
};
