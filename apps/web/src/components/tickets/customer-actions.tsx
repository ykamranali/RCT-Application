'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, RotateCcw, Star, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

import type { TicketOverview } from '@rct/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { decideWork, reopenTicket, submitFeedback } from '@/lib/actions/tickets';
import { cn } from '@/lib/utils';

/**
 * The customer's side of a ticket: confirm the work, send it back, reopen a
 * closed ticket, or rate the visit. Each action routes through a
 * SECURITY DEFINER function that re-checks ownership in the database.
 */
export function CustomerActions({
  ticket,
  hasFeedback,
}: {
  ticket: TicketOverview;
  hasFeedback: boolean;
}) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const awaitingConfirmation = ticket.status === 'RESOLVED';
  const canReopen = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';
  const canRate = (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') && !hasFeedback;

  async function confirm() {
    setBusy(true);
    try {
      const result = await decideWork(ticket.id, true);
      if (!result.ok) {
        toast.error(result.message ?? 'That did not work.');
        return;
      }
      toast.success(result.message ?? 'Thank you for confirming.');
      router.refresh();
      if (!hasFeedback) setFeedbackOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {awaitingConfirmation ? (
        <Card className="border-success/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Is this resolved?</CardTitle>
            <CardDescription>
              Confirming closes the ticket and sends you the signed service report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="success" className="w-full" loading={busy} onClick={() => void confirm()}>
              <CheckCircle2 className="h-4 w-4" /> Yes, it is resolved
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setRejectOpen(true)} disabled={busy}>
              <ThumbsDown className="h-4 w-4" /> No, there is still a problem
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(canReopen && !awaitingConfirmation) || canRate ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {canRate ? (
              <Button variant="outline" className="w-full" onClick={() => setFeedbackOpen(true)}>
                <Star className="h-4 w-4" /> Rate this service
              </Button>
            ) : null}
            {canReopen && !awaitingConfirmation ? (
              <Button variant="outline" className="w-full" onClick={() => setReopenOpen(true)}>
                <RotateCcw className="h-4 w-4" /> Reopen this ticket
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="What is still wrong?"
        description="Tell us what is outstanding and the ticket goes straight back to the engineer."
        label="What still needs attention"
        placeholder="The connection dropped again about an hour after the engineer left."
        confirmLabel="Send back to the engineer"
        minLength={5}
        onSubmit={async (reason) => {
          const result = await decideWork(ticket.id, false, reason);
          if (result.ok) router.refresh();
          return result;
        }}
      />

      <ReasonDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Reopen this ticket"
        description="Let us know what has happened and we will pick it straight back up."
        label="Why does this need reopening?"
        placeholder="The same fault has come back this morning."
        confirmLabel="Reopen ticket"
        minLength={10}
        onSubmit={async (reason) => {
          const result = await reopenTicket(ticket.id, reason);
          if (result.ok) router.refresh();
          return result;
        }}
      />

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        ticket={ticket}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------

function ReasonDialog({
  open, onOpenChange, title, description, label, placeholder, confirmLabel, minLength, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  minLength: number;
  onSubmit: (reason: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const result = await onSubmit(reason.trim());
      if (!result.ok) {
        toast.error(result.message ?? 'That did not work.');
        return;
      }
      toast.success(result.message ?? 'Thank you.');
      setReason('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reason" required>{label}</Label>
          <Textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
          {reason.trim().length > 0 && reason.trim().length < minLength ? (
            <p className="text-xs text-muted-foreground">
              A little more detail please — at least {minLength} characters.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} loading={saving} disabled={reason.trim().length < minLength}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDialog({
  open, onOpenChange, ticket, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: TicketOverview;
  onDone: () => void;
}) {
  const [overall, setOverall] = useState(0);
  const [engineer, setEngineer] = useState(0);
  const [service, setService] = useState(0);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (overall === 0) {
      toast.error('Please choose an overall rating.');
      return;
    }
    setSaving(true);
    try {
      const result = await submitFeedback({
        ticketId: ticket.id,
        customerId: ticket.customer_id,
        engineerId: ticket.assigned_engineer_id,
        overallRating: overall,
        engineerRating: engineer || undefined,
        serviceRating: service || undefined,
        issueResolved: true,
        comments: comments.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.message ?? 'The feedback could not be saved.');
        return;
      }
      toast.success('Thank you for your feedback.');
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How did we do?</DialogTitle>
          <DialogDescription>
            Your rating goes directly into the engineer&apos;s performance review, so it genuinely matters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Stars label="Overall service" value={overall} onChange={setOverall} required />
          {ticket.engineer_name ? (
            <Stars label={`Your engineer, ${ticket.engineer_name}`} value={engineer} onChange={setEngineer} />
          ) : null}
          <Stars label="Speed of response" value={service} onChange={setService} />

          <div className="space-y-1.5">
            <Label htmlFor="feedback-comments">Anything else? (optional)</Label>
            <Textarea id="feedback-comments" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Tell us what went well, or what we could do better." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Not now</Button>
          <Button onClick={() => void submit()} loading={saving} disabled={overall === 0}>Submit feedback</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stars({
  label, value, onChange, required,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} out of 5`}
            onClick={() => onChange(star)}
            className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                star <= value ? 'fill-warning text-warning' : 'text-muted-foreground/40',
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}
